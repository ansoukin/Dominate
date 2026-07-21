//! 数据库迁移
//!
//! 使用 refinery 自动执行 migrations 目录下的 SQL 迁移脚本。

use refinery::embed_migrations;

use crate::db::Database;
use crate::error::Result;

embed_migrations!("migrations");

impl Database {
    /// 执行数据库迁移
    ///
    /// refinery 会自动检测当前 schema 版本并应用未执行的迁移脚本。
    /// 迁移脚本位于 `src-tauri/migrations/` 目录。
    pub fn run_migrations(&self) -> Result<()> {
        tracing::info!("开始执行数据库迁移");

        let report = self.with_conn_mut(|conn| {
            migrations::runner()
                .run(conn)
                .map_err(crate::error::AppError::from)
        })?;

        if report.applied_migrations().is_empty() {
            tracing::info!("数据库已是最新版本，无需迁移");
        } else {
            for migration in report.applied_migrations() {
                tracing::info!(
                    "已应用迁移: {} ({})",
                    migration.name(),
                    migration.version()
                );
            }
        }

        Ok(())
    }
}
