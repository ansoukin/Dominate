-- V003__courses.sql - 课程与课表数据模型
-- 对应 SPEC 3.5 页面 2（时间轴）：学期制 / 节次格点 / 临时调课 / 课程实体
-- 新增 4 张表：semesters / class_periods / courses / schedule_overrides

-- 学期表（多周课表的基础，SPEC：学期制不分单双周）
CREATE TABLE semesters (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,                       -- 如 "2025-2026 第一学期"
    start_date TEXT NOT NULL,                 -- 学期开始日期 ISO "2026-09-01"
    end_date TEXT NOT NULL,                   -- 学期结束日期 ISO "2027-01-20"
    total_weeks INTEGER NOT NULL,             -- 总周数
    is_active INTEGER NOT NULL DEFAULT 0,     -- 0=false, 1=true（当前激活学期）
    created_at TEXT NOT NULL,                 -- ISO 8601 时间戳
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_semesters_active ON semesters(is_active);

-- 节次定义表（格点模式基础：第 N 节的时间段）
-- 按学期可配置：不同学期可有不同作息时间
CREATE TABLE class_periods (
    id TEXT PRIMARY KEY NOT NULL,
    semester_id TEXT NOT NULL,
    period_index INTEGER NOT NULL,            -- 第几节（1, 2, 3...）
    start_time TEXT NOT NULL,                 -- "08:00"
    end_time TEXT NOT NULL,                   -- "08:45"
    label TEXT,                               -- 可选标签如 "早读"/"晚自习"
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
    UNIQUE(semester_id, period_index)
);

CREATE INDEX idx_periods_semester ON class_periods(semester_id);

-- 课程条目表（课表的每一格课程）
CREATE TABLE courses (
    id TEXT PRIMARY KEY NOT NULL,
    semester_id TEXT NOT NULL,
    subject_name TEXT NOT NULL,               -- 科目名 "数学"
    day_of_week INTEGER NOT NULL,             -- 0=周日, 1=周一 ... 6=周六
    period_index INTEGER,                     -- 格点模式：第几节（自由模式为 NULL）
    start_time TEXT,                          -- 自由模式："14:30"（格点模式由 period_index 决定）
    end_time TEXT,                            -- 自由模式结束时间
    week_pattern TEXT NOT NULL DEFAULT 'all', -- 周次模式: "all"/"odd"/"even"/"1,3,5,7"
    location TEXT,                            -- 教室地点
    teacher TEXT,                             -- 教师
    color TEXT,                               -- 颜色标识（hex）
    flow_id TEXT,                             -- 关联快捷指令（课前/课中/课后触发，可空）
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
    FOREIGN KEY (flow_id) REFERENCES automation_flows(id) ON DELETE SET NULL
);

CREATE INDEX idx_courses_semester ON courses(semester_id);
CREATE INDEX idx_courses_day ON courses(semester_id, day_of_week);
CREATE INDEX idx_courses_flow ON courses(flow_id);

-- 临时调课记录表（某天的临时调整，不修改常规课表）
-- SPEC 3.5 页面 2：临时调课
CREATE TABLE schedule_overrides (
    id TEXT PRIMARY KEY NOT NULL,
    semester_id TEXT NOT NULL,
    date TEXT NOT NULL,                       -- 生效日期 ISO "2026-07-22"
    course_id TEXT,                           -- 原课程 ID（NULL 表示新增临时课程）
    override_type TEXT NOT NULL,              -- "cancel" 取消 / "move" 调整 / "add" 新增
    new_day_of_week INTEGER,                  -- 调整后的星期（move 时）
    new_period_index INTEGER,                 -- 调整后节次（move 时）
    new_start_time TEXT,                      -- 调整后时间（自由模式 move 时）
    new_end_time TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_overrides_date ON schedule_overrides(semester_id, date);
CREATE INDEX idx_overrides_course ON schedule_overrides(course_id);
