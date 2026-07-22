-- V004__seed_courses.sql - 预置示例学期与课表数据
--
-- 为首次启动提供可演示的示例数据：
-- - 1 个激活学期（2026 春季，20 周）
-- - 8 节课的节次时间表（含早读/晚自习）
-- - 示例课程（覆盖周一到周五，格点 + 自由模式各若干）
--
-- 注意：所有 ID 使用固定 UUID，便于幂等性检查（refinery 已保证不重复执行）

-- ============================================================
-- 学期：2026 春季
-- ============================================================
INSERT INTO semesters (id, name, start_date, end_date, total_weeks, is_active, created_at, updated_at)
VALUES (
    'seed-sem-2026spring',
    '2026 春季学期',
    '2026-02-23',
    '2026-07-12',
    20,
    1,
    '2026-02-20T00:00:00Z',
    '2026-02-20T00:00:00Z'
);

-- ============================================================
-- 节次定义（8 节 + 早读 + 晚自习）
-- ============================================================
INSERT INTO class_periods (id, semester_id, period_index, start_time, end_time, label) VALUES
('seed-period-0', 'seed-sem-2026spring', 0, '07:30', '08:00', '早读'),
('seed-period-1', 'seed-sem-2026spring', 1, '08:00', '08:45', NULL),
('seed-period-2', 'seed-sem-2026spring', 2, '08:55', '09:40', NULL),
('seed-period-3', 'seed-sem-2026spring', 3, '10:00', '10:45', NULL),
('seed-period-4', 'seed-sem-2026spring', 4, '10:55', '11:40', NULL),
('seed-period-5', 'seed-sem-2026spring', 5, '14:00', '14:45', NULL),
('seed-period-6', 'seed-sem-2026spring', 6, '14:55', '15:40', NULL),
('seed-period-7', 'seed-sem-2026spring', 7, '16:00', '16:45', NULL),
('seed-period-8', 'seed-sem-2026spring', 8, '19:00', '19:45', '晚自习');

-- ============================================================
-- 示例课程（周一到周五）
-- ============================================================

-- 周一（day_of_week=1）
INSERT INTO courses (id, semester_id, subject_name, day_of_week, period_index, start_time, end_time, week_pattern, location, teacher, color, flow_id, note, created_at, updated_at) VALUES
('seed-course-001', 'seed-sem-2026spring', '数学', 1, 1, NULL, NULL, 'all', '教学楼 A301', '张老师', '#2563eb', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-002', 'seed-sem-2026spring', '语文', 1, 2, NULL, NULL, 'all', '教学楼 A301', '李老师', '#dc2626', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-003', 'seed-sem-2026spring', '英语', 1, 3, NULL, NULL, 'all', '教学楼 B205', '王老师', '#7c3aed', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-004', 'seed-sem-2026spring', '物理', 1, 5, NULL, NULL, 'all', '实验楼 C101', '陈老师', '#16a34a', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z');

-- 周二（day_of_week=2）
INSERT INTO courses (id, semester_id, subject_name, day_of_week, period_index, start_time, end_time, week_pattern, location, teacher, color, flow_id, note, created_at, updated_at) VALUES
('seed-course-010', 'seed-sem-2026spring', '语文', 2, 1, NULL, NULL, 'all', '教学楼 A301', '李老师', '#dc2626', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-011', 'seed-sem-2026spring', '数学', 2, 2, NULL, NULL, 'all', '教学楼 A301', '张老师', '#2563eb', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-012', 'seed-sem-2026spring', '化学', 2, 3, NULL, NULL, 'odd', '实验楼 C102', '刘老师', '#ca8a04', NULL, '单周实验课', '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-013', 'seed-sem-2026spring', '英语', 2, 5, NULL, NULL, 'all', '教学楼 B205', '王老师', '#7c3aed', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z');

-- 周三（day_of_week=3）
INSERT INTO courses (id, semester_id, subject_name, day_of_week, period_index, start_time, end_time, week_pattern, location, teacher, color, flow_id, note, created_at, updated_at) VALUES
('seed-course-020', 'seed-sem-2026spring', '英语', 3, 1, NULL, NULL, 'all', '教学楼 B205', '王老师', '#7c3aed', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-021', 'seed-sem-2026spring', '数学', 3, 2, NULL, NULL, 'all', '教学楼 A301', '张老师', '#2563eb', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-022', 'seed-sem-2026spring', '生物', 3, 3, NULL, NULL, 'even', '实验楼 C103', '赵老师', '#0891b2', NULL, '双周实验课', '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
-- 自由模式课程：周三下午社团活动 15:00-17:00
('seed-course-023', 'seed-sem-2026spring', '社团活动', 3, NULL, '15:00', '17:00', 'all', '学生活动中心', NULL, '#db2777', NULL, '自由模式示例', '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z');

-- 周四（day_of_week=4）
INSERT INTO courses (id, semester_id, subject_name, day_of_week, period_index, start_time, end_time, week_pattern, location, teacher, color, flow_id, note, created_at, updated_at) VALUES
('seed-course-030', 'seed-sem-2026spring', '数学', 4, 1, NULL, NULL, 'all', '教学楼 A301', '张老师', '#2563eb', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-031', 'seed-sem-2026spring', '物理', 4, 2, NULL, NULL, 'all', '实验楼 C101', '陈老师', '#16a34a', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-032', 'seed-sem-2026spring', '语文', 4, 5, NULL, NULL, 'all', '教学楼 A301', '李老师', '#dc2626', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z');

-- 周五（day_of_week=5）
INSERT INTO courses (id, semester_id, subject_name, day_of_week, period_index, start_time, end_time, week_pattern, location, teacher, color, flow_id, note, created_at, updated_at) VALUES
('seed-course-040', 'seed-sem-2026spring', '英语', 5, 1, NULL, NULL, 'all', '教学楼 B205', '王老师', '#7c3aed', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-041', 'seed-sem-2026spring', '数学', 5, 2, NULL, NULL, 'all', '教学楼 A301', '张老师', '#2563eb', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
('seed-course-042', 'seed-sem-2026spring', '体育', 5, 5, NULL, NULL, 'all', '操场', '周老师', '#c026d3', NULL, NULL, '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z'),
-- 自由模式课程：周五晚自习延长 19:00-21:30
('seed-course-043', 'seed-sem-2026spring', '晚自习', 5, NULL, '19:00', '21:30', 'all', '教学楼 A301', NULL, '#64748b', NULL, '自由模式示例', '2026-02-20T00:00:00Z', '2026-02-20T00:00:00Z');
