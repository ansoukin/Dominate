//! 动作链执行引擎模块
//!
//! 负责加载快捷指令的所有动作、按 `parent_id` 构建树形结构、按 `order` 顺序执行，
//! 并处理控制流（if/else、loop、变量传递）与容错策略（Continue/Stop/Rollback/Notify）。

pub mod chain;

pub use chain::ChainEngine;
