# Dominate

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4.svg)]()
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131.svg?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-stable-CE422B.svg?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![Version](https://img.shields.io/badge/Version-0.4.0--alpha.1-orange.svg)]()
[![Phase](https://img.shields.io/badge/Phase-1%20Complete-brightgreen.svg)]()

个人自动化助手 — 基于 Tauri v2 + Rust 的 Windows 桌面自动化工具。

通过"快捷指令 + 可视化积木"理念，将时间触发、系统事件、手动操作等多种触发方式与 20 种动作类型组合，实现日常场景的自动化。

## 当前状态

**Phase 1 已完成** — 核心调度与动作执行骨架：

- Tauri v2 + Rust 后端骨架
- 数据库初始化（rusqlite + refinery，5 张核心表）
- 20 种动作执行器（应用 / 媒体 / 系统 / 通知 / 控制流 / Lua）
- 触发器调度器（Cron / 系统事件 / 手动三类）
- 动作链执行引擎（ChainEngine，支持顺序、分支、循环、容错）
- Tauri 命令暴露（Flow / Action / Trigger / Log / Setting 完整 CRUD）
- 15 个 unit tests 通过

## 技术栈

**后端**：Rust（edition 2021）、Tauri v2、SQLite（rusqlite + refinery）、tokio、tracing、mlua（Lua 5.4）

**前端**（Phase 2 起）：React 18、TypeScript、Vite、Tailwind CSS、shadcn/ui、React Flow

## 快速开始

### 环境要求

- Rust 工具链（stable channel）
- Visual Studio 2022 Build Tools（v143 工具集，x64）
- Git

### 编译与测试

```powershell
cd src-tauri
.\check.bat
```

脚本依次运行 `cargo check` 与 `cargo test --lib`，结果写入 `cargo_check.log` 与 `cargo_test.log`。

## 项目结构

```text
Dominate/
├── src-tauri/
│   ├── src/
│   │   ├── db/              # 数据库层（connection / migrations / repository）
│   │   ├── models/          # 数据模型（flow / action / trigger / log / setting）
│   │   ├── actions/         # 20 种动作执行器
│   │   ├── triggers/        # 触发器（cron / system_event / manual / scheduler）
│   │   ├── executor/        # 动作链执行引擎 ChainEngine
│   │   ├── commands/        # Tauri 命令暴露层
│   │   ├── state.rs         # 应用全局状态
│   │   └── error.rs         # 错误类型
│   ├── migrations/          # SQL 迁移脚本
│   └── Cargo.toml
├── docs/
│   └── SPEC.md              # 设计规格文档
└── .gitignore
```

## 设计文档

完整的 26 轮需求讨论与设计决策见 [docs/SPEC.md](docs/SPEC.md)。

## 目标平台

- Windows 10/11，x64
- 全局管理员权限运行（UAC 关闭）
- 不考虑跨平台

## License

[MIT](LICENSE)
