import argparse
import csv
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
from pathlib import Path


max_csv_field_size = sys.maxsize
while True:
    try:
        csv.field_size_limit(max_csv_field_size)
        break
    except OverflowError:
        max_csv_field_size = int(max_csv_field_size / 10)


HOST = "127.0.0.1"
PG_USER = "postgres"
DB_NAME = "sie5204"
OPERATIONAL_TABLES = [
    "ecpgtitulo",
    "ecpgparcela",
    "ecpgbaixa",
    "ecrcparcela",
    "ecrcbaixa",
    "ecxamovcxabco",
    "ecxatransacaoofx",
    "ecxavinculoconciliacaoofx",
    "eadcpedidocompra",
    "eadcitempedido",
    "ecadcliente",
    "ecadobra",
]


def quote_sqlite_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def quote_pg_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


class ImportStatus:
    def __init__(self, path: Path, job_id: str, source_name: str, output_path: Path):
        self.path = path
        self.data = {
            "id": job_id,
            "status": "running",
            "sourceFileName": source_name,
            "sqlitePath": str(output_path),
            "startedAt": now_iso(),
            "updatedAt": now_iso(),
            "message": "Importacao iniciada.",
            "steps": [
                {"key": "validate", "label": "Validar arquivo", "status": "pending", "message": "Aguardando leitura do dump."},
                {"key": "tools", "label": "Preparar ferramentas locais", "status": "pending", "message": "Aguardando PostgreSQL local."},
                {"key": "restore", "label": "Restaurar dump", "status": "pending", "message": "Aguardando restauracao temporaria."},
                {"key": "catalog", "label": "Ler catalogo", "status": "pending", "message": "Aguardando tabelas e colunas."},
                {"key": "sqlite", "label": "Gerar SQLite", "status": "pending", "message": "Aguardando conversao das tabelas."},
                {"key": "finalize", "label": "Publicar dados", "status": "pending", "message": "Aguardando validacao final."},
            ],
        }
        self.write()

    def write(self):
        self.data["updatedAt"] = now_iso()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

    def step(self, key: str, status: str, message: str):
        for step in self.data["steps"]:
            if step["key"] == key:
                step["status"] = status
                step["message"] = message
                if status == "running":
                    step["startedAt"] = now_iso()
                if status in {"completed", "failed"}:
                    step["finishedAt"] = now_iso()
                break
        self.data["message"] = message
        self.write()

    def complete(self, message: str, table_count: int, row_count: int, operational_counts: dict[str, int]):
        self.data.update(
            {
                "status": "completed",
                "message": message,
                "finishedAt": now_iso(),
                "tableCount": table_count,
                "rowCount": row_count,
                "operationalCounts": operational_counts,
            }
        )
        self.write()

    def fail(self, message: str):
        self.data.update({"status": "failed", "message": message, "error": message, "finishedAt": now_iso()})
        self.write()


def run(command: list[str], *, env: dict[str, str] | None = None, check: bool = True, timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        check=check,
        timeout=timeout,
    )


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((HOST, 0))
        return int(sock.getsockname()[1])


def executable_name(name: str) -> str:
    return f"{name}.exe" if os.name == "nt" else name


def candidate_pg_bins(frontend_root: Path) -> list[Path]:
    candidates: list[Path] = []
    env_bin = os.environ.get("SIENGE_POSTGRES_BIN") or os.environ.get("POSTGRES_BIN")
    if env_bin:
        candidates.append(Path(env_bin))
    candidates.extend(
        [
            frontend_root.parent / "postgresql-15.2" / "pgsql" / "bin",
            frontend_root / "postgresql-15.2" / "pgsql" / "bin",
        ]
    )
    pg_restore_path = shutil.which(executable_name("pg_restore"))
    if pg_restore_path:
        candidates.append(Path(pg_restore_path).parent)
    return candidates


def find_pg_tools(frontend_root: Path) -> dict[str, str]:
    for candidate in candidate_pg_bins(frontend_root):
        tools = {
            "initdb": candidate / executable_name("initdb"),
            "postgres": candidate / executable_name("postgres"),
            "psql": candidate / executable_name("psql"),
            "pg_restore": candidate / executable_name("pg_restore"),
        }
        if all(path.exists() for path in tools.values()):
            return {key: str(value) for key, value in tools.items()}
    raise RuntimeError(
        "Nao encontrei os executaveis locais do PostgreSQL. Configure SIENGE_POSTGRES_BIN ou mantenha o PostgreSQL portatil em ../postgresql-15.2/pgsql/bin."
    )


def validate_dump(dump_path: Path):
    if not dump_path.exists():
        raise RuntimeError("Arquivo de dump nao encontrado.")
    with dump_path.open("rb") as file:
        header = file.read(5)
    if header != b"PGDMP":
        raise RuntimeError("O arquivo selecionado nao parece ser um dump PostgreSQL customizado do Sienge.")


def start_postgres(tools: dict[str, str], cluster_dir: Path, port: int) -> subprocess.Popen[str]:
    if cluster_dir.exists():
        shutil.rmtree(cluster_dir)
    cluster_dir.parent.mkdir(parents=True, exist_ok=True)
    run([tools["initdb"], "-D", str(cluster_dir), "-U", PG_USER, "-A", "trust"])
    process = subprocess.Popen(
        [tools["postgres"], "-D", str(cluster_dir), "-h", HOST, "-p", str(port)],
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 45
    last_error = ""
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError("O PostgreSQL temporario encerrou antes de aceitar conexoes.")
        result = run([tools["psql"], "-h", HOST, "-p", str(port), "-U", PG_USER, "-d", "postgres", "-c", "SELECT 1"], check=False)
        if result.returncode == 0:
            return process
        last_error = result.stderr.strip()
        time.sleep(1)
    process.terminate()
    raise RuntimeError(last_error or "O PostgreSQL temporario nao iniciou a tempo.")


def stop_postgres(tools: dict[str, str], port: int, process: subprocess.Popen[str] | None):
    run([tools["psql"], "-h", HOST, "-p", str(port), "-U", PG_USER, "-d", "postgres", "-c", "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid()"], check=False)
    run([tools["psql"], "-h", HOST, "-p", str(port), "-U", PG_USER, "-d", "postgres", "-c", "SELECT pg_reload_conf()"], check=False)
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()


def psql_copy_query(tools: dict[str, str], port: int, database: str, query: str, output_path: Path):
    command = [
        tools["psql"],
        "-h",
        HOST,
        "-p",
        str(port),
        "-U",
        PG_USER,
        "-d",
        database,
        "-c",
        f"COPY ({query}) TO STDOUT WITH CSV HEADER",
    ]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    with output_path.open("w", encoding="utf-8", newline="") as file:
        shutil.copyfileobj(process.stdout, file)
    stderr = process.stderr.read() if process.stderr else ""
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(stderr.strip() or f"psql retornou codigo {return_code}.")


def build_catalogs(tools: dict[str, str], port: int, data_dir: Path) -> tuple[Path, Path]:
    table_catalog = data_dir / "dump-table-catalog.csv"
    column_catalog = data_dir / "dump-column-catalog.csv"
    psql_copy_query(
        tools,
        port,
        DB_NAME,
        """
        SELECT
          n.nspname AS schemaname,
          c.relname AS table_name,
          c.reltuples::bigint AS estimated_rows,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
        FROM pg_class c
        INNER JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname = 'public'
        ORDER BY c.relname
        """,
        table_catalog,
    )
    psql_copy_query(
        tools,
        port,
        DB_NAME,
        """
        SELECT
          table_schema,
          table_name,
          ordinal_position,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
        """,
        column_catalog,
    )
    return table_catalog, column_catalog


def load_tables(table_catalog: Path) -> list[dict[str, str]]:
    with table_catalog.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    return [row for row in rows if row.get("schemaname") == "public" and row.get("table_name")]


def load_columns(column_catalog: Path) -> dict[str, list[dict[str, str]]]:
    by_table: dict[str, list[dict[str, str]]] = {}
    with column_catalog.open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            if row.get("table_schema") != "public":
                continue
            by_table.setdefault(row["table_name"], []).append(row)
    return by_table


def create_metadata(conn: sqlite3.Connection, source_name: str, source_path: Path, tables: list[dict[str, str]], columns: dict[str, list[dict[str, str]]]):
    conn.execute("CREATE TABLE _sienge_dump_extraction (key TEXT PRIMARY KEY, value TEXT)")
    conn.execute(
        """
        CREATE TABLE _sienge_dump_tables (
            table_name TEXT PRIMARY KEY,
            estimated_rows INTEGER,
            total_size TEXT,
            extracted_rows INTEGER DEFAULT 0,
            extraction_status TEXT DEFAULT 'pending',
            error_message TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE _sienge_dump_columns (
            table_name TEXT,
            ordinal_position INTEGER,
            column_name TEXT,
            data_type TEXT,
            is_nullable TEXT
        )
        """
    )
    conn.executemany(
        "INSERT INTO _sienge_dump_tables (table_name, estimated_rows, total_size) VALUES (?, ?, ?)",
        [(row["table_name"], int(float(row.get("estimated_rows") or 0)), row.get("total_size") or "") for row in tables],
    )
    conn.executemany(
        """
        INSERT INTO _sienge_dump_columns (table_name, ordinal_position, column_name, data_type, is_nullable)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (table, int(column.get("ordinal_position") or 0), column["column_name"], column.get("data_type") or "", column.get("is_nullable") or "")
            for table, table_columns in columns.items()
            for column in table_columns
        ],
    )
    conn.executemany(
        "INSERT INTO _sienge_dump_extraction (key, value) VALUES (?, ?)",
        [
            ("source_database", DB_NAME),
            ("created_at", time.strftime("%Y-%m-%d %H:%M:%S")),
            ("source_dump", source_name),
            ("source_path", str(source_path)),
        ],
    )


def create_table(conn: sqlite3.Connection, table_name: str, table_columns: list[dict[str, str]]):
    columns_sql = ", ".join(f"{quote_sqlite_identifier(column['column_name'])} TEXT" for column in table_columns)
    conn.execute(f"DROP TABLE IF EXISTS {quote_sqlite_identifier(table_name)}")
    conn.execute(f"CREATE TABLE {quote_sqlite_identifier(table_name)} ({columns_sql})")


def copy_table_to_sqlite(tools: dict[str, str], port: int, conn: sqlite3.Connection, table_name: str, table_columns: list[dict[str, str]]) -> int:
    pg_table = f"public.{quote_pg_identifier(table_name)}"
    command = [
        tools["psql"],
        "-h",
        HOST,
        "-p",
        str(port),
        "-U",
        PG_USER,
        "-d",
        DB_NAME,
        "-c",
        f"COPY {pg_table} TO STDOUT WITH CSV",
    ]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    reader = csv.reader(process.stdout)
    placeholders = ", ".join(["?"] * len(table_columns))
    insert_sql = f"INSERT INTO {quote_sqlite_identifier(table_name)} VALUES ({placeholders})"
    batch: list[list[str]] = []
    count = 0
    for row in reader:
        batch.append(row)
        if len(batch) >= 1000:
            conn.executemany(insert_sql, batch)
            count += len(batch)
            batch.clear()
    if batch:
        conn.executemany(insert_sql, batch)
        count += len(batch)
    stderr = process.stderr.read() if process.stderr is not None else ""
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(stderr.strip() or f"psql retornou codigo {return_code}.")
    return count


def convert_to_sqlite(tools: dict[str, str], port: int, source_name: str, source_path: Path, table_catalog: Path, column_catalog: Path, output_tmp: Path, status: ImportStatus) -> tuple[int, int, dict[str, int]]:
    tables = load_tables(table_catalog)
    columns = load_columns(column_catalog)
    if output_tmp.exists():
        output_tmp.unlink()
    conn = sqlite3.connect(output_tmp)
    try:
        conn.execute("PRAGMA journal_mode=OFF")
        conn.execute("PRAGMA synchronous=OFF")
        conn.execute("PRAGMA temp_store=MEMORY")
        create_metadata(conn, source_name, source_path, tables, columns)
        conn.commit()

        total = len(tables)
        started = time.time()
        for index, table in enumerate(tables, start=1):
            table_name = table["table_name"]
            table_columns = columns.get(table_name, [])
            if not table_columns:
                continue
            try:
                create_table(conn, table_name, table_columns)
                rows = copy_table_to_sqlite(tools, port, conn, table_name, table_columns)
                conn.execute(
                    """
                    UPDATE _sienge_dump_tables
                    SET extracted_rows = ?, extraction_status = 'done', error_message = NULL
                    WHERE table_name = ?
                    """,
                    (rows, table_name),
                )
                conn.commit()
            except Exception as exc:
                conn.execute(
                    """
                    UPDATE _sienge_dump_tables
                    SET extraction_status = 'error', error_message = ?
                    WHERE table_name = ?
                    """,
                    (str(exc)[:1000], table_name),
                )
                conn.commit()
            if index == 1 or index % 25 == 0 or index == total:
                elapsed = int(time.time() - started)
                status.step("sqlite", "running", f"{index}/{total} tabelas convertidas em {elapsed}s.")

        row = conn.execute(
            "SELECT count(*), coalesce(sum(extracted_rows), 0) FROM _sienge_dump_tables WHERE extraction_status = 'done'"
        ).fetchone()
        table_count = int(row[0] if row else 0)
        row_count = int(row[1] if row else 0)
        operational_counts: dict[str, int] = {}
        for table_name in OPERATIONAL_TABLES:
            exists = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table_name,)).fetchone()
            if exists:
                count = conn.execute(f"SELECT count(*) FROM {quote_sqlite_identifier(table_name)}").fetchone()[0]
                operational_counts[table_name] = int(count)
        return table_count, row_count, operational_counts
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dump", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--status", required=True)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--source-name", required=True)
    parser.add_argument("--data-dir", required=True)
    args = parser.parse_args()

    frontend_root = Path.cwd()
    dump_path = Path(args.dump).resolve()
    output_path = Path(args.output).resolve()
    data_dir = Path(args.data_dir).resolve()
    status = ImportStatus(Path(args.status).resolve(), args.job_id, args.source_name, output_path)
    output_tmp = output_path.with_suffix(".sqlite.tmp")
    cluster_dir = data_dir / "pg-dump-import-cluster"
    port = find_free_port()
    postgres_process: subprocess.Popen[str] | None = None

    try:
        status.step("validate", "running", "Validando formato do arquivo selecionado.")
        validate_dump(dump_path)
        status.step("validate", "completed", "Arquivo validado como dump PostgreSQL do Sienge.")

        status.step("tools", "running", "Localizando PostgreSQL portatil para restaurar o dump.")
        tools = find_pg_tools(frontend_root)
        status.step("tools", "completed", "Ferramentas locais encontradas.")

        status.step("restore", "running", "Subindo PostgreSQL temporario e restaurando o dump.")
        postgres_process = start_postgres(tools, cluster_dir, port)
        run([tools["psql"], "-h", HOST, "-p", str(port), "-U", PG_USER, "-d", "postgres", "-c", f"DROP DATABASE IF EXISTS {DB_NAME} WITH (FORCE)"], check=False)
        restore = run(
            [
                tools["pg_restore"],
                "-h",
                HOST,
                "-p",
                str(port),
                "-U",
                PG_USER,
                "-d",
                "postgres",
                "--create",
                "--no-owner",
                "--no-privileges",
                str(dump_path),
            ],
            check=False,
        )
        (data_dir / "pg_restore.log").write_text((restore.stdout or "") + "\n" + (restore.stderr or ""), encoding="utf-8")
        if restore.returncode != 0:
            raise RuntimeError((restore.stderr or restore.stdout or "Falha ao restaurar dump.").strip()[:2000])
        status.step("restore", "completed", "Dump restaurado temporariamente.")

        status.step("catalog", "running", "Lendo lista de tabelas e colunas.")
        table_catalog, column_catalog = build_catalogs(tools, port, data_dir)
        table_count = len(load_tables(table_catalog))
        status.step("catalog", "completed", f"{table_count} tabelas encontradas no dump.")

        status.step("sqlite", "running", "Convertendo tabelas para SQLite.")
        converted_tables, converted_rows, operational_counts = convert_to_sqlite(
            tools,
            port,
            args.source_name,
            dump_path,
            table_catalog,
            column_catalog,
            output_tmp,
            status,
        )
        status.step("sqlite", "completed", f"{converted_tables} tabelas e {converted_rows} linhas convertidas.")

        status.step("finalize", "running", "Validando e publicando o SQLite no sistema.")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        os.replace(output_tmp, output_path)
        status.step("finalize", "completed", "SQLite publicado para as telas do sistema.")
        status.complete("Importacao concluida. O sistema ja pode usar o dump convertido.", converted_tables, converted_rows, operational_counts)
    except Exception as exc:
        for step in status.data["steps"]:
            if step["status"] == "running":
                status.step(step["key"], "failed", str(exc))
                break
        status.fail(str(exc))
        if output_tmp.exists():
            output_tmp.unlink()
        raise
    finally:
        if postgres_process is not None:
            stop_postgres(tools, port, postgres_process)
        if cluster_dir.exists():
            shutil.rmtree(cluster_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
