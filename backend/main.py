from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from models.database import get_db, create_tables, engine, SessionLocal
from models import database as models
from models.schemas import *
import uvicorn
from datetime import date, timedelta
from decimal import Decimal

app = FastAPI(title="Project Management API", version="1.0.0")

# CORS設定（フロントエンドからのアクセス許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# データベーステーブル作成
create_tables()

# 初期データ投入 - lifespan イベントに修正
@app.on_event("startup")
async def startup_event():
    db = SessionLocal()
    try:
        # コードマスタの初期データ
        if not db.query(models.CodeMaster).first():
            code_data = [
                ("STATUS", "NOT_STARTED", "未着手"),
                ("STATUS", "IN_PROGRESS", "進行中"),
                ("STATUS", "COMPLETED", "完了"),
                ("STATUS", "ACTIVE", "アクティブ"),
                ("STATUS", "INACTIVE", "非アクティブ"),
                ("PRIORITY", "HIGH", "高"),
                ("PRIORITY", "MEDIUM", "中"),
                ("PRIORITY", "LOW", "低"),
            ]
            for code_type, code_value, code_label in code_data:
                db.add(models.CodeMaster(code_type=code_type, code_value=code_value, code_label=code_label))
            
            # サンプル社員データ
            employees = [
                models.Employee(employee_name="田中太郎", email="tanaka@example.com", daily_work_hours=8.0),
                models.Employee(employee_name="佐藤花子", email="sato@example.com", daily_work_hours=7.5),
                models.Employee(employee_name="鈴木一郎", email="suzuki@example.com", daily_work_hours=8.0),
            ]
            for emp in employees:
                db.add(emp)
            
            db.commit()
    finally:
        db.close()

# ============ Employee API ============
@app.get("/api/employees", response_model=List[Employee])
def get_employees(db: Session = Depends(get_db)):
    """社員一覧取得"""
    return db.query(models.Employee).all()

@app.get("/api/employees/{employee_id}", response_model=Employee)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    """社員詳細取得"""
    employee = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@app.post("/api/employees", response_model=Employee)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db)):
    """社員作成"""
    db_employee = models.Employee(**employee.model_dump())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

# ============ 社員更新API（新規追加） ============
@app.put("/api/employees/{employee_id}", response_model=Employee)
def update_employee(employee_id: int, employee_update: EmployeeUpdate, db: Session = Depends(get_db)):
    """社員情報更新"""
    db_employee = db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # メールアドレスの重複チェック
    if employee_update.email and employee_update.email != db_employee.email:
        existing_email = db.query(models.Employee).filter(
            models.Employee.email == employee_update.email,
            models.Employee.employee_id != employee_id
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists")
    
    # 更新処理
    for field, value in employee_update.model_dump(exclude_unset=True).items():
        setattr(db_employee, field, value)
    
    db.commit()
    db.refresh(db_employee)
    return db_employee

# ============ Project API ============
@app.get("/api/projects", response_model=List[Project])
def get_projects(db: Session = Depends(get_db)):
    """プロジェクト一覧取得"""
    return db.query(models.Project).all()

@app.get("/api/projects/{project_id}", response_model=Project)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """プロジェクト詳細取得"""
    project = db.query(models.Project).filter(models.Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.post("/api/projects", response_model=Project)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """プロジェクト作成"""
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@app.put("/api/projects/{project_id}", response_model=Project)
def update_project(project_id: int, project_update: ProjectUpdate, db: Session = Depends(get_db)):
    """プロジェクト更新"""
    db_project = db.query(models.Project).filter(models.Project.project_id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    for field, value in project_update.model_dump(exclude_unset=True).items():
        setattr(db_project, field, value)
    
    db.commit()
    db.refresh(db_project)
    return db_project

# ============ ProjectPhase API ============ (新規追加)
@app.get("/api/projects/{project_id}/phases", response_model=List[ProjectPhase])
def get_project_phases(project_id: int, db: Session = Depends(get_db)):
    """プロジェクトフェーズ一覧取得"""
    return db.query(models.ProjectPhase).filter(
        models.ProjectPhase.project_id == project_id
    ).order_by(models.ProjectPhase.sort_order).all()

@app.post("/api/project-phases", response_model=ProjectPhase)
def create_project_phase(phase: ProjectPhaseCreate, db: Session = Depends(get_db)):
    """プロジェクトフェーズ作成"""
    db_phase = models.ProjectPhase(**phase.model_dump())
    db.add(db_phase)
    db.commit()
    db.refresh(db_phase)
    return db_phase

@app.put("/api/project-phases/{phase_id}", response_model=ProjectPhase)
def update_project_phase(phase_id: int, phase_update: ProjectPhaseUpdate, db: Session = Depends(get_db)):
    """プロジェクトフェーズ更新"""
    db_phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.phase_id == phase_id).first()
    if not db_phase:
        raise HTTPException(status_code=404, detail="Phase not found")
    
    for field, value in phase_update.model_dump(exclude_unset=True).items():
        setattr(db_phase, field, value)
    
    db.commit()
    db.refresh(db_phase)
    return db_phase

@app.delete("/api/project-phases/{phase_id}")
def delete_project_phase(phase_id: int, db: Session = Depends(get_db)):
    """プロジェクトフェーズ削除"""
    db_phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.phase_id == phase_id).first()
    if not db_phase:
        raise HTTPException(status_code=404, detail="Phase not found")
    
    # 関連タスクのphase_idをNULLに設定
    db.query(models.Task).filter(models.Task.phase_id == phase_id).update({"phase_id": None})
    
    db.delete(db_phase)
    db.commit()
    return {"message": "Phase deleted"}

# ============ Project Member API ============
@app.get("/api/projects/{project_id}/members", response_model=List[ProjectMember])
def get_project_members(project_id: int, db: Session = Depends(get_db)):
    """プロジェクトメンバー一覧取得"""
    members = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id
    ).all()
    
    if not members:
        return []
    
    result = []
    for member in members:
        employee = db.query(models.Employee).filter(
            models.Employee.employee_id == member.employee_id
        ).first()
        
        member_data = ProjectMember(
            project_id=member.project_id,
            employee_id=member.employee_id,
            role_in_project=member.role_in_project,
            allocation_ratio=member.allocation_ratio,
            join_date=member.join_date,
            leave_date=member.leave_date,
            employee=employee
        )
        result.append(member_data)
    
    return result

@app.post("/api/project-members", response_model=ProjectMember)
def add_project_member(member: ProjectMemberCreate, db: Session = Depends(get_db)):
    """プロジェクトメンバー追加"""
    existing = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == member.project_id,
        models.ProjectMember.employee_id == member.employee_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Employee is already a member of this project")
    
    member_dict = member.model_dump()
    if not member_dict.get('join_date'):
        from datetime import date
        member_dict['join_date'] = date.today()
    
    db_member = models.ProjectMember(**member_dict)
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    
    employee = db.query(models.Employee).filter(
        models.Employee.employee_id == db_member.employee_id
    ).first()
    
    return ProjectMember(
        project_id=db_member.project_id,
        employee_id=db_member.employee_id,
        role_in_project=db_member.role_in_project,
        allocation_ratio=db_member.allocation_ratio,
        join_date=db_member.join_date,
        leave_date=db_member.leave_date,
        employee=employee
    )

@app.delete("/api/project-members/{project_id}/{employee_id}")
def remove_project_member(project_id: int, employee_id: int, db: Session = Depends(get_db)):
    """プロジェクトメンバー削除"""
    member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.employee_id == employee_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Project member not found")
    
    db.delete(member)
    db.commit()
    return {"message": "Project member removed"}

@app.put("/api/project-members/{project_id}/{employee_id}", response_model=ProjectMember)
def update_project_member(
    project_id: int, 
    employee_id: int, 
    member_update: ProjectMemberBase, 
    db: Session = Depends(get_db)
):
    """プロジェクトメンバー情報更新"""
    member = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.employee_id == employee_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Project member not found")
    
    for field, value in member_update.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    
    db.commit()
    db.refresh(member)
    
    employee = db.query(models.Employee).filter(
        models.Employee.employee_id == member.employee_id
    ).first()
    
    return ProjectMember(
        project_id=member.project_id,
        employee_id=member.employee_id,
        role_in_project=member.role_in_project,
        allocation_ratio=member.allocation_ratio,
        join_date=member.join_date,
        leave_date=member.leave_date,
        employee=employee
    )

# ============ Task API ============
@app.get("/api/projects/{project_id}/tasks", response_model=List[WBSTask])
def get_project_tasks(project_id: int, db: Session = Depends(get_db)):
    """プロジェクトのタスク一覧取得（WBS用）"""
    tasks = db.query(models.Task).filter(models.Task.project_id == project_id).all()
    
    result = []
    for task in tasks:
        # チェックリスト進捗率計算
        checklists = db.query(models.TaskChecklist).filter(models.TaskChecklist.task_id == task.task_id).all()
        completed_count = sum(1 for c in checklists if c.is_done)
        progress = completed_count / len(checklists) if checklists else 0.0
        
        # 担当者取得
        assignee_rel = db.query(models.TaskAssignee).filter(models.TaskAssignee.task_id == task.task_id).first()
        assignee = assignee_rel.employee if assignee_rel else None
        
        # 依存関係取得
        dependencies = db.query(models.TaskDependency).filter(models.TaskDependency.task_id == task.task_id).all()
        
        # フェーズ情報取得
        phase = db.query(models.ProjectPhase).filter(models.ProjectPhase.phase_id == task.phase_id).first() if task.phase_id else None
        
        wbs_task = WBSTask(
            **{k: v for k, v in task.__dict__.items() if not k.startswith('_')},
            assignee=assignee,
            phase=phase,
            checklist_progress=progress,
            checklist_items=checklists,
            dependencies=dependencies
        )
        result.append(wbs_task)
    
    return result

@app.post("/api/tasks", response_model=Task)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """タスク作成"""
    # プロジェクトメンバーの検証
    if task.assignee_id:
        member = db.query(models.ProjectMember).filter(
            models.ProjectMember.project_id == task.project_id,
            models.ProjectMember.employee_id == task.assignee_id
        ).first()
        if not member:
            raise HTTPException(status_code=400, detail="指定された担当者はこのプロジェクトのメンバーではありません")
    
    task_data = task.model_dump(exclude={'assignee_id'})
    db_task = models.Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # 担当者割当
    if task.assignee_id:
        assignee = models.TaskAssignee(task_id=db_task.task_id, employee_id=task.assignee_id)
        db.add(assignee)
        db.commit()
    
    return db_task

@app.put("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    """タスク更新（担当者更新処理追加）"""
    db_task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # 担当者更新処理（修正：追加）
    if hasattr(task_update, 'assignee_id') and 'assignee_id' in task_update.model_dump(exclude_unset=True):
        # 既存の担当者割当を削除
        existing_assignee = db.query(models.TaskAssignee).filter(
            models.TaskAssignee.task_id == task_id
        ).first()
        if existing_assignee:
            db.delete(existing_assignee)
        
        # 新しい担当者を割当（assignee_idがNoneでない場合のみ）
        if task_update.assignee_id:
            # プロジェクトメンバーの検証
            member = db.query(models.ProjectMember).filter(
                models.ProjectMember.project_id == db_task.project_id,
                models.ProjectMember.employee_id == task_update.assignee_id
            ).first()
            if not member:
                raise HTTPException(status_code=400, detail="指定された担当者はこのプロジェクトのメンバーではありません")
            
            new_assignee = models.TaskAssignee(
                task_id=task_id, 
                employee_id=task_update.assignee_id
            )
            db.add(new_assignee)
    
    # タスク基本情報の更新（assignee_idは除外）
    update_data = task_update.model_dump(exclude_unset=True)
    if 'assignee_id' in update_data:
        del update_data['assignee_id']
    
    for field, value in update_data.items():
        setattr(db_task, field, value)
    
    db.commit()
    db.refresh(db_task)
    
    # 担当者情報を正しく取得してレスポンスを構築
    assignee_relation = db.query(models.TaskAssignee).filter(
        models.TaskAssignee.task_id == task_id
    ).first()
    
    assignee = None
    if assignee_relation:
        assignee = db.query(models.Employee).filter(
            models.Employee.employee_id == assignee_relation.employee_id
        ).first()
    
    # フェーズ情報取得
    phase = db.query(models.ProjectPhase).filter(
        models.ProjectPhase.phase_id == db_task.phase_id
    ).first() if db_task.phase_id else None
    
    # Taskスキーマに合わせてレスポンスを構築
    task_data = {
        'task_id': db_task.task_id,
        'project_id': db_task.project_id,
        'phase_id': db_task.phase_id,
        'task_name': db_task.task_name,
        'description': db_task.description,
        'estimated_duration': db_task.estimated_duration,
        'start_date': db_task.start_date,
        'end_date': db_task.end_date,
        'earliest_start': db_task.earliest_start,
        'deadline': db_task.deadline,
        'status_code': db_task.status_code,
        'milestone_flag': db_task.milestone_flag,
        'x_position': db_task.x_position,
        'y_position': db_task.y_position,
        'assignee': assignee,
        'phase': phase
    }
    
    return Task(**task_data)

# ============ Task Dependency API ============
@app.post("/api/task-dependencies", response_model=TaskDependency)
def create_dependency(dependency: TaskDependencyCreate, db: Session = Depends(get_db)):
    """タスク依存関係作成"""
    db_dependency = models.TaskDependency(**dependency.model_dump())
    db.add(db_dependency)
    db.commit()
    db.refresh(db_dependency)
    return db_dependency

@app.delete("/api/task-dependencies/{task_id}/{depends_on_id}")
def delete_dependency(task_id: int, depends_on_id: int, db: Session = Depends(get_db)):
    """タスク依存関係削除"""
    dependency = db.query(models.TaskDependency).filter(
        models.TaskDependency.task_id == task_id,
        models.TaskDependency.depends_on_id == depends_on_id
    ).first()
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")
    
    db.delete(dependency)
    db.commit()
    return {"message": "Dependency deleted"}

# ============ Task Checklist API ============
@app.get("/api/tasks/{task_id}/checklists", response_model=List[TaskChecklist])
def get_task_checklists(task_id: int, db: Session = Depends(get_db)):
    """タスクのチェックリスト取得"""
    return db.query(models.TaskChecklist).filter(
        models.TaskChecklist.task_id == task_id
    ).order_by(models.TaskChecklist.sort_order).all()

@app.post("/api/task-checklists", response_model=TaskChecklist)
def create_checklist(checklist: TaskChecklistCreate, db: Session = Depends(get_db)):
    """チェックリストアイテム作成"""
    db_checklist = models.TaskChecklist(**checklist.model_dump())
    db.add(db_checklist)
    db.commit()
    db.refresh(db_checklist)
    return db_checklist

@app.put("/api/task-checklists/{checklist_id}", response_model=TaskChecklist)
def update_checklist(checklist_id: int, checklist: TaskChecklistUpdate, db: Session = Depends(get_db)):
    """チェックリストアイテム更新"""
    db_checklist = db.query(models.TaskChecklist).filter(
        models.TaskChecklist.checklist_id == checklist_id
    ).first()
    if not db_checklist:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    for field, value in checklist.model_dump(exclude_unset=True).items():
        setattr(db_checklist, field, value)
    
    db.commit()
    db.refresh(db_checklist)
    return db_checklist

# ============ Schedule Calculation API ============
@app.post("/api/projects/{project_id}/calculate-schedule", response_model=ScheduleCalculationResult)
def calculate_schedule(project_id: int, db: Session = Depends(get_db)):
    """スケジュール・クリティカルパス自動計算"""
    project = db.query(models.Project).filter(models.Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = db.query(models.Task).filter(models.Task.project_id == project_id).all()
    dependencies = db.query(models.TaskDependency).join(
        models.Task, models.TaskDependency.task_id == models.Task.task_id
    ).filter(models.Task.project_id == project_id).all()
    
    if not tasks:
        return ScheduleCalculationResult(
            tasks=[],
            critical_path=[],
            total_duration=0
        )
    
    # タスク辞書作成
    task_dict = {task.task_id: task for task in tasks}
    
    # プロジェクト開始日を基準日として使用
    if project.start_date:
        project_start_date = project.start_date
    else:
        project_start_date = date.today()
    
    # 営業日計算用のヘルパー関数
    def add_business_days(start_date: date, days: int) -> date:
        """営業日を加算（土日をスキップ）"""
        current_date = start_date
        days_added = 0
        
        while days_added < days:
            current_date += timedelta(days=1)
            if current_date.weekday() < 5:  # 0-4 が月-金
                days_added += 1
                
        return current_date
    
    def get_next_business_day(input_date: date) -> date:
        """翌営業日を取得"""
        next_date = input_date + timedelta(days=1)
        
        while next_date.weekday() >= 5:  # 土曜日(5)または日曜日(6)
            next_date += timedelta(days=1)
            
        return next_date
    
    # 稼働率を考慮した実際の所要日数を計算
    def calculate_actual_duration(task_id: int, estimated_duration: Decimal) -> int:
        """担当者の稼働率を考慮した実際の所要日数を計算"""
        assignee_rel = db.query(models.TaskAssignee).filter(
            models.TaskAssignee.task_id == task_id
        ).first()
        
        if not assignee_rel:
            return max(1, int(float(estimated_duration)))
        
        member = db.query(models.ProjectMember).filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.employee_id == assignee_rel.employee_id
        ).first()
        
        allocation_ratio = float(member.allocation_ratio) if member else 1.0
        actual_duration = float(estimated_duration) / allocation_ratio
        
        return max(1, int(actual_duration))
    
    # トポロジカルソート用のグラフ構築
    in_degree = {task.task_id: 0 for task in tasks}
    adj_list = {task.task_id: [] for task in tasks}
    
    for dep in dependencies:
        adj_list[dep.depends_on_id].append(dep.task_id)
        in_degree[dep.task_id] += 1
    
    # トポロジカルソートでタスクの実行順序を決定
    queue = [task_id for task_id in in_degree if in_degree[task_id] == 0]
    sorted_tasks = []
    
    while queue:
        current_task_id = queue.pop(0)
        sorted_tasks.append(current_task_id)
        
        for next_task_id in adj_list[current_task_id]:
            in_degree[next_task_id] -= 1
            if in_degree[next_task_id] == 0:
                queue.append(next_task_id)
    
    # 循環依存チェック
    if len(sorted_tasks) != len(tasks):
        raise HTTPException(
            status_code=400, 
            detail="Circular dependency detected in tasks"
        )
    
    # Forward Pass（最早開始日・終了日算出）
    for task_id in sorted_tasks:
        task = task_dict[task_id]
        predecessors = [dep for dep in dependencies if dep.task_id == task_id]
        
        if not predecessors:
            candidate_start_dates = [project_start_date]
            
            if task.earliest_start:
                candidate_start_dates.append(task.earliest_start)
            
            task.start_date = max(candidate_start_dates)
        else:
            predecessor_end_dates = []
            for dep in predecessors:
                predecessor_task = task_dict[dep.depends_on_id]
                if predecessor_task.end_date:
                    next_business_day = get_next_business_day(predecessor_task.end_date)
                    predecessor_end_dates.append(next_business_day)
            
            if predecessor_end_dates:
                earliest_start_from_predecessors = max(predecessor_end_dates)
            else:
                earliest_start_from_predecessors = project_start_date
            
            candidate_start_dates = [earliest_start_from_predecessors]
            if task.earliest_start:
                candidate_start_dates.append(task.earliest_start)
            
            task.start_date = max(candidate_start_dates)
                
            if task.start_date < project_start_date:
                task.start_date = project_start_date
        
        # 終了日計算
        estimated_duration = task.estimated_duration or Decimal('1')
        actual_duration_days = calculate_actual_duration(task_id, estimated_duration)
        task.end_date = add_business_days(task.start_date, actual_duration_days - 1)
    
    # クリティカルパス計算
    if tasks:
        final_task = max(tasks, key=lambda t: t.end_date or date.min)
        critical_path = []
        
        def trace_critical_path(task_id: int, visited: set) -> list:
            if task_id in visited:
                return []
            visited.add(task_id)
            
            path = [task_id]
            task = task_dict[task_id]
            
            predecessors = [dep for dep in dependencies if dep.task_id == task_id]
            if predecessors:
                critical_predecessor = None
                max_end_date = date.min
                
                for dep in predecessors:
                    pred_task = task_dict[dep.depends_on_id]
                    if pred_task.end_date and pred_task.end_date > max_end_date:
                        max_end_date = pred_task.end_date
                        critical_predecessor = dep.depends_on_id
                
                if critical_predecessor:
                    preceding_path = trace_critical_path(critical_predecessor, visited)
                    path = preceding_path + path
            
            return path
        
        critical_path = trace_critical_path(final_task.task_id, set())
    else:
        critical_path = []
    
    # DB更新
    for task in tasks:
        db.merge(task)
    db.commit()
    
    # 総期間計算
    if tasks and any(task.start_date and task.end_date for task in tasks):
        project_start = min((task.start_date for task in tasks if task.start_date), default=project_start_date)
        project_end = max((task.end_date for task in tasks if task.end_date), default=project_start_date)
        total_duration = (project_end - project_start).days + 1
    else:
        total_duration = 0
    
    # レスポンス用のTaskオブジェクト構築
    response_tasks = []
    for task in tasks:
        assignee_relation = db.query(models.TaskAssignee).filter(
            models.TaskAssignee.task_id == task.task_id
        ).first()
        
        assignee = None
        if assignee_relation:
            assignee = db.query(models.Employee).filter(
                models.Employee.employee_id == assignee_relation.employee_id
            ).first()
        
        # フェーズ情報取得
        phase = db.query(models.ProjectPhase).filter(
            models.ProjectPhase.phase_id == task.phase_id
        ).first() if task.phase_id else None
        
        task_data = {
            'task_id': task.task_id,
            'project_id': task.project_id,
            'phase_id': task.phase_id,
            'task_name': task.task_name,
            'description': task.description,
            'estimated_duration': task.estimated_duration,
            'start_date': task.start_date,
            'end_date': task.end_date,
            'earliest_start': task.earliest_start,
            'deadline': task.deadline,
            'status_code': task.status_code,
            'milestone_flag': task.milestone_flag,
            'x_position': task.x_position,
            'y_position': task.y_position,
            'assignee': assignee,
            'phase': phase
        }
        
        response_tasks.append(Task(**task_data))
    
    return ScheduleCalculationResult(
        tasks=response_tasks,
        critical_path=critical_path,
        total_duration=total_duration
    )

# ============ Task Dependency API ============
@app.post("/api/task-dependencies", response_model=TaskDependency)
def create_dependency(dependency: TaskDependencyCreate, db: Session = Depends(get_db)):
    """タスク依存関係作成"""
    db_dependency = models.TaskDependency(**dependency.model_dump())
    db.add(db_dependency)
    db.commit()
    db.refresh(db_dependency)
    return db_dependency

@app.delete("/api/task-dependencies/{task_id}/{depends_on_id}")
def delete_dependency(task_id: int, depends_on_id: int, db: Session = Depends(get_db)):
    """タスク依存関係削除"""
    dependency = db.query(models.TaskDependency).filter(
        models.TaskDependency.task_id == task_id,
        models.TaskDependency.depends_on_id == depends_on_id
    ).first()
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")
    
    db.delete(dependency)
    db.commit()
    return {"message": "Dependency deleted"}

# ============ Task Checklist API ============
@app.get("/api/tasks/{task_id}/checklists", response_model=List[TaskChecklist])
def get_task_checklists(task_id: int, db: Session = Depends(get_db)):
    """タスクのチェックリスト取得"""
    return db.query(models.TaskChecklist).filter(
        models.TaskChecklist.task_id == task_id
    ).order_by(models.TaskChecklist.sort_order).all()

@app.post("/api/task-checklists", response_model=TaskChecklist)
def create_checklist(checklist: TaskChecklistCreate, db: Session = Depends(get_db)):
    """チェックリストアイテム作成"""
    db_checklist = models.TaskChecklist(**checklist.model_dump())
    db.add(db_checklist)
    db.commit()
    db.refresh(db_checklist)
    return db_checklist

@app.put("/api/task-checklists/{checklist_id}", response_model=TaskChecklist)
def update_checklist(checklist_id: int, checklist: TaskChecklistUpdate, db: Session = Depends(get_db)):
    """チェックリストアイテム更新"""
    db_checklist = db.query(models.TaskChecklist).filter(
        models.TaskChecklist.checklist_id == checklist_id
    ).first()
    if not db_checklist:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    for field, value in checklist.model_dump(exclude_unset=True).items():
        setattr(db_checklist, field, value)
    
    db.commit()
    db.refresh(db_checklist)
    return db_checklist

# ============ Schedule Calculation API ============
@app.post("/api/projects/{project_id}/calculate-schedule", response_model=ScheduleCalculationResult)
def calculate_schedule(project_id: int, db: Session = Depends(get_db)):
    """スケジュール・クリティカルパス自動計算"""
    project = db.query(models.Project).filter(models.Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = db.query(models.Task).filter(models.Task.project_id == project_id).all()
    dependencies = db.query(models.TaskDependency).join(
        models.Task, models.TaskDependency.task_id == models.Task.task_id
    ).filter(models.Task.project_id == project_id).all()
    
    if not tasks:
        return ScheduleCalculationResult(
            tasks=[],
            critical_path=[],
            total_duration=0
        )
    
    # タスク辞書作成
    task_dict = {task.task_id: task for task in tasks}
    
    # プロジェクト開始日を基準日として使用
    if project.start_date:
        project_start_date = project.start_date
    else:
        project_start_date = date.today()
    
    # 営業日計算用のヘルパー関数
    def add_business_days(start_date: date, days: int) -> date:
        """営業日を加算（土日をスキップ）"""
        current_date = start_date
        days_added = 0
        
        while days_added < days:
            current_date += timedelta(days=1)
            if current_date.weekday() < 5:  # 0-4 が月-金
                days_added += 1
                
        return current_date
    
    def get_next_business_day(input_date: date) -> date:
        """翌営業日を取得"""
        next_date = input_date + timedelta(days=1)
        
        while next_date.weekday() >= 5:  # 土曜日(5)または日曜日(6)
            next_date += timedelta(days=1)
            
        return next_date
    
    # 稼働率を考慮した実際の所要日数を計算
    def calculate_actual_duration(task_id: int, estimated_duration: Decimal) -> int:
        """担当者の稼働率を考慮した実際の所要日数を計算"""
        assignee_rel = db.query(models.TaskAssignee).filter(
            models.TaskAssignee.task_id == task_id
        ).first()
        
        if not assignee_rel:
            return max(1, int(float(estimated_duration)))
        
        member = db.query(models.ProjectMember).filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.employee_id == assignee_rel.employee_id
        ).first()
        
        allocation_ratio = float(member.allocation_ratio) if member else 1.0
        actual_duration = float(estimated_duration) / allocation_ratio
        
        return max(1, int(actual_duration))
    
    # トポロジカルソート用のグラフ構築
    in_degree = {task.task_id: 0 for task in tasks}
    adj_list = {task.task_id: [] for task in tasks}
    
    for dep in dependencies:
        adj_list[dep.depends_on_id].append(dep.task_id)
        in_degree[dep.task_id] += 1
    
    # トポロジカルソートでタスクの実行順序を決定
    queue = [task_id for task_id in in_degree if in_degree[task_id] == 0]
    sorted_tasks = []
    
    while queue:
        current_task_id = queue.pop(0)
        sorted_tasks.append(current_task_id)
        
        for next_task_id in adj_list[current_task_id]:
            in_degree[next_task_id] -= 1
            if in_degree[next_task_id] == 0:
                queue.append(next_task_id)
    
    # 循環依存チェック
    if len(sorted_tasks) != len(tasks):
        raise HTTPException(
            status_code=400, 
            detail="Circular dependency detected in tasks"
        )
    
    # Forward Pass（最早開始日・終了日算出）
    for task_id in sorted_tasks:
        task = task_dict[task_id]
        predecessors = [dep for dep in dependencies if dep.task_id == task_id]
        
        if not predecessors:
            candidate_start_dates = [project_start_date]
            
            if task.earliest_start:
                candidate_start_dates.append(task.earliest_start)
            
            task.start_date = max(candidate_start_dates)
        else:
            predecessor_end_dates = []
            for dep in predecessors:
                predecessor_task = task_dict[dep.depends_on_id]
                if predecessor_task.end_date:
                    next_business_day = get_next_business_day(predecessor_task.end_date)
                    predecessor_end_dates.append(next_business_day)
            
            if predecessor_end_dates:
                earliest_start_from_predecessors = max(predecessor_end_dates)
            else:
                earliest_start_from_predecessors = project_start_date
            
            candidate_start_dates = [earliest_start_from_predecessors]
            if task.earliest_start:
                candidate_start_dates.append(task.earliest_start)
            
            task.start_date = max(candidate_start_dates)
                
            if task.start_date < project_start_date:
                task.start_date = project_start_date
        
        # 終了日計算
        estimated_duration = task.estimated_duration or Decimal('1')
        actual_duration_days = calculate_actual_duration(task_id, estimated_duration)
        task.end_date = add_business_days(task.start_date, actual_duration_days - 1)
    
    # クリティカルパス計算
    if tasks:
        final_task = max(tasks, key=lambda t: t.end_date or date.min)
        critical_path = []
        
        def trace_critical_path(task_id: int, visited: set) -> list:
            if task_id in visited:
                return []
            visited.add(task_id)
            
            path = [task_id]
            task = task_dict[task_id]
            
            predecessors = [dep for dep in dependencies if dep.task_id == task_id]
            if predecessors:
                critical_predecessor = None
                max_end_date = date.min
                
                for dep in predecessors:
                    pred_task = task_dict[dep.depends_on_id]
                    if pred_task.end_date and pred_task.end_date > max_end_date:
                        max_end_date = pred_task.end_date
                        critical_predecessor = dep.depends_on_id
                
                if critical_predecessor:
                    preceding_path = trace_critical_path(critical_predecessor, visited)
                    path = preceding_path + path
            
            return path
        
        critical_path = trace_critical_path(final_task.task_id, set())
    else:
        critical_path = []
    
    # DB更新
    for task in tasks:
        db.merge(task)
    db.commit()
    
    # 総期間計算
    if tasks and any(task.start_date and task.end_date for task in tasks):
        project_start = min((task.start_date for task in tasks if task.start_date), default=project_start_date)
        project_end = max((task.end_date for task in tasks if task.end_date), default=project_start_date)
        total_duration = (project_end - project_start).days + 1
    else:
        total_duration = 0
    
    # レスポンス用のTaskオブジェクト構築
    response_tasks = []
    for task in tasks:
        assignee_relation = db.query(models.TaskAssignee).filter(
            models.TaskAssignee.task_id == task.task_id
        ).first()
        
        assignee = None
        if assignee_relation:
            assignee = db.query(models.Employee).filter(
                models.Employee.employee_id == assignee_relation.employee_id
            ).first()
        
        # フェーズ情報取得
        phase = db.query(models.ProjectPhase).filter(
            models.ProjectPhase.phase_id == task.phase_id
        ).first() if task.phase_id else None
        
        task_data = {
            'task_id': task.task_id,
            'project_id': task.project_id,
            'phase_id': task.phase_id,
            'task_name': task.task_name,
            'description': task.description,
            'estimated_duration': task.estimated_duration,
            'start_date': task.start_date,
            'end_date': task.end_date,
            'earliest_start': task.earliest_start,
            'deadline': task.deadline,
            'status_code': task.status_code,
            'milestone_flag': task.milestone_flag,
            'x_position': task.x_position,
            'y_position': task.y_position,
            'assignee': assignee,
            'phase': phase
        }
        
        response_tasks.append(Task(**task_data))
    
    return ScheduleCalculationResult(
        tasks=response_tasks,
        critical_path=critical_path,
        total_duration=total_duration
    )

# ============ Code Master API ============
@app.get("/api/codes/{code_type}")
def get_codes(code_type: str, db: Session = Depends(get_db)):
    """コードマスタ取得"""
    return db.query(models.CodeMaster).filter(models.CodeMaster.code_type == code_type).all()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)