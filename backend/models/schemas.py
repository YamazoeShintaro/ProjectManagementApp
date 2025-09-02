from pydantic import BaseModel
from typing import Optional, List
from datetime import date

# Employee schemas
class EmployeeBase(BaseModel):
    employee_name: str
    email: str
    daily_work_hours: Optional[float] = 8.0

class EmployeeCreate(EmployeeBase):
    pass

# 社員更新用スキーマ（新規追加）
class EmployeeUpdate(BaseModel):
    employee_name: Optional[str] = None
    email: Optional[str] = None
    daily_work_hours: Optional[float] = None

class Employee(EmployeeBase):
    employee_id: int
    
    class Config:
        from_attributes = True

# ProjectPhase schemas (新規追加)
class ProjectPhaseBase(BaseModel):
    phase_name: str
    description: Optional[str] = None
    sort_order: Optional[int] = 0
    phase_color: Optional[str] = "#1976d2"

class ProjectPhaseCreate(ProjectPhaseBase):
    project_id: int

class ProjectPhaseUpdate(BaseModel):
    phase_name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    phase_color: Optional[str] = None

class ProjectPhase(ProjectPhaseBase):
    phase_id: int
    project_id: int
    
    class Config:
        from_attributes = True

# Project schemas
class ProjectBase(BaseModel):
    project_name: str
    client_name: Optional[str] = None
    manager_id: Optional[int] = None
    budget: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status_code: Optional[str] = "ACTIVE"

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    manager_id: Optional[int] = None
    budget: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status_code: Optional[str] = None

class Project(ProjectBase):
    project_id: int
    manager: Optional[Employee] = None
    phases: List[ProjectPhase] = []
    
    class Config:
        from_attributes = True

# Task schemas
class TaskBase(BaseModel):
    task_name: str
    description: Optional[str] = None
    estimated_duration: Optional[float] = 1.0
    earliest_start: Optional[date] = None
    deadline: Optional[date] = None
    status_code: Optional[str] = "NOT_STARTED"
    milestone_flag: Optional[bool] = False
    x_position: Optional[int] = 0
    y_position: Optional[int] = 0

class TaskCreate(TaskBase):
    project_id: int
    phase_id: Optional[int] = None  # 追加
    assignee_id: Optional[int] = None

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    description: Optional[str] = None
    estimated_duration: Optional[float] = None
    phase_id: Optional[int] = None  # 追加
    status_code: Optional[str] = None
    x_position: Optional[int] = None
    y_position: Optional[int] = None
    assignee_id: Optional[int] = None  # 修正：担当者更新用に追加

class Task(TaskBase):
    task_id: int
    project_id: int
    phase_id: Optional[int] = None  # 追加
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    assignee: Optional[Employee] = None
    phase: Optional[ProjectPhase] = None  # 追加
    
    class Config:
        from_attributes = True

# Task Dependency schemas
class TaskDependencyBase(BaseModel):
    task_id: int
    depends_on_id: int
    dependency_type: str = "FS"

class TaskDependencyCreate(TaskDependencyBase):
    pass

class TaskDependency(TaskDependencyBase):
    class Config:
        from_attributes = True

# Task Checklist schemas
class TaskChecklistBase(BaseModel):
    item_name: str
    is_done: bool = False
    sort_order: int = 0

class TaskChecklistCreate(TaskChecklistBase):
    task_id: int

class TaskChecklistUpdate(BaseModel):
    item_name: Optional[str] = None
    is_done: Optional[bool] = None
    sort_order: Optional[int] = None

class TaskChecklist(TaskChecklistBase):
    checklist_id: int
    task_id: int
    
    class Config:
        from_attributes = True

# スケジュール計算用レスポンス
class ScheduleCalculationResult(BaseModel):
    tasks: List[Task]
    critical_path: List[int]
    total_duration: int

# WBS表示用拡張タスク
class WBSTask(Task):
    checklist_progress: float = 0.0
    checklist_items: List[TaskChecklist] = []
    dependencies: List[TaskDependency] = []

class ProjectMemberBase(BaseModel):
    role_in_project: Optional[str] = None
    allocation_ratio: Optional[float] = 1.0
    join_date: Optional[date] = None
    leave_date: Optional[date] = None

class ProjectMemberCreate(ProjectMemberBase):
    project_id: int
    employee_id: int

class ProjectMember(ProjectMemberBase):
    project_id: int
    employee_id: int
    employee: Optional[Employee] = None
    
    class Config:
        from_attributes = True