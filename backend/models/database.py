from sqlalchemy import create_engine, Column, Integer, String, Text, Date, Boolean, ForeignKey, DateTime, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, date
import os
from dotenv import load_dotenv

# 環境変数読み込み
load_dotenv()

# データベース接続設定
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pm_user:pm_password@localhost:5432/project_management")

# デバッグ用：接続情報確認
print(f"Using DATABASE_URL: {DATABASE_URL}")
print(f".env file exists: {os.path.exists('.env')}")
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        print(f".env contents: {f.read().strip()}")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """データベースセッション取得"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Employee(Base):
    """社員マスタ"""
    __tablename__ = "employee"
    
    employee_id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    daily_work_hours = Column(Numeric(5, 2), default=8.0)  # 1日の稼働時間
    
    # リレーションシップ
    managed_projects = relationship("Project", back_populates="manager", foreign_keys="[Project.manager_id]")
    project_memberships = relationship("ProjectMember", back_populates="employee")
    task_assignments = relationship("TaskAssignee", back_populates="employee")

class CodeMaster(Base):
    """汎用コードマスタ"""
    __tablename__ = "code_master"
    
    id = Column(Integer, primary_key=True, index=True)
    code_type = Column(String(50), nullable=False)
    code_value = Column(String(50), nullable=False, unique=True)
    code_label = Column(String(100), nullable=False)

class Project(Base):
    """プロジェクトマスタ"""
    __tablename__ = "project"
    
    project_id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(200), nullable=False)
    client_name = Column(String(100))
    manager_id = Column(Integer, ForeignKey("employee.employee_id"))
    budget = Column(Numeric(15, 2))
    start_date = Column(Date)
    end_date = Column(Date)
    status_code = Column(String(50), ForeignKey("code_master.code_value"))
    
    # リレーションシップ
    manager = relationship("Employee", back_populates="managed_projects", foreign_keys=[manager_id])
    members = relationship("ProjectMember", back_populates="project")
    tasks = relationship("Task", back_populates="project")
    phases = relationship("ProjectPhase", back_populates="project")  # 追加

class ProjectMember(Base):
    """プロジェクト参加者中間テーブル"""
    __tablename__ = "project_member"
    
    project_id = Column(Integer, ForeignKey("project.project_id"), primary_key=True)
    employee_id = Column(Integer, ForeignKey("employee.employee_id"), primary_key=True)
    role_in_project = Column(String(100))
    allocation_ratio = Column(Numeric(5, 2), default=1.0)
    join_date = Column(Date)
    leave_date = Column(Date)
    
    # リレーションシップ
    project = relationship("Project", back_populates="members")
    employee = relationship("Employee", back_populates="project_memberships")

class ProjectPhase(Base):
    """プロジェクト大分類（フェーズ）"""
    __tablename__ = "project_phase"
    
    phase_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.project_id"), nullable=False)
    phase_name = Column(String(100), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    phase_color = Column(String(7), default="#1976d2")  # 16進数カラーコード
    
    # リレーションシップ
    project = relationship("Project", back_populates="phases")
    tasks = relationship("Task", back_populates="phase")

class Task(Base):
    """タスク（WBSノード）"""
    __tablename__ = "task"
    
    task_id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.project_id"))
    phase_id = Column(Integer, ForeignKey("project_phase.phase_id"))  # 追加
    task_name = Column(String(200), nullable=False)
    description = Column(Text)
    estimated_duration = Column(Numeric(5, 2))
    start_date = Column(Date)
    end_date = Column(Date)
    earliest_start = Column(Date)
    deadline = Column(Date)
    status_code = Column(String(50), ForeignKey("code_master.code_value"))
    milestone_flag = Column(Boolean, default=False)
    
    # PERT図用座標
    x_position = Column(Integer, default=0)
    y_position = Column(Integer, default=0)
    
    # リレーションシップ
    project = relationship("Project", back_populates="tasks")
    phase = relationship("ProjectPhase", back_populates="tasks")  # 追加
    assignee = relationship("TaskAssignee", back_populates="task", uselist=False)
    checklists = relationship("TaskChecklist", back_populates="task")
    dependencies = relationship("TaskDependency", back_populates="task", foreign_keys="[TaskDependency.task_id]")
    dependent_tasks = relationship("TaskDependency", back_populates="depends_on_task", foreign_keys="[TaskDependency.depends_on_id]")

class TaskDependency(Base):
    """タスク間依存関係"""
    __tablename__ = "task_dependency"
    
    task_id = Column(Integer, ForeignKey("task.task_id"), primary_key=True)
    depends_on_id = Column(Integer, ForeignKey("task.task_id"), primary_key=True)
    dependency_type = Column(String(10), default="FS")
    
    # リレーションシップ
    task = relationship("Task", back_populates="dependencies", foreign_keys=[task_id])
    depends_on_task = relationship("Task", back_populates="dependent_tasks", foreign_keys=[depends_on_id])

class TaskAssignee(Base):
    """タスク担当者（1タスク1人制約）"""
    __tablename__ = "task_assignee"
    
    task_id = Column(Integer, ForeignKey("task.task_id"), primary_key=True)
    employee_id = Column(Integer, ForeignKey("employee.employee_id"))
    allocation_ratio = Column(Numeric(5, 2), default=1.0)
    
    # リレーションシップ
    task = relationship("Task", back_populates="assignee")
    employee = relationship("Employee", back_populates="task_assignments")

class TaskChecklist(Base):
    """タスクチェックリスト"""
    __tablename__ = "task_checklist"
    
    checklist_id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("task.task_id"))
    item_name = Column(String(200), nullable=False)
    is_done = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    
    # リレーションシップ
    task = relationship("Task", back_populates="checklists")

# テーブル作成
def create_tables():
    Base.metadata.create_all(bind=engine)