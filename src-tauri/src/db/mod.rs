//! 数据库模块
//!
//! 基于 rusqlite + refinery 提供数据库连接管理、迁移与 CRUD 操作。

pub mod connection;
pub mod migrations;
pub mod repository;

pub use connection::Database;
pub use repository::Repository;
