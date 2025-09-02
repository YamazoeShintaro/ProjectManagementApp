// データ型定義
export interface Employee {
  employee_id: number;
  employee_name: string;
  email: string;
  daily_work_hours?: number;
}

export interface ProjectPhase {
  phase_id: number;
  project_id: number;
  phase_name: string;
  description?: string;
  sort_order: number;
  phase_color: string;
}

export interface Project {
  project_id: number;
  project_name: string;
  client_name?: string;
  manager_id?: number;
  manager?: Employee;
  budget?: number;
  start_date?: string;
  end_date?: string;
  status_code?: string;
  phases?: ProjectPhase[];
}

export interface ProjectMember {
  project_id: number;
  employee_id: number;
  employee?: Employee;
  role_in_project?: string;
  allocation_ratio?: number;
  join_date?: string;
  leave_date?: string;
}

export interface Task {
  task_id: number;
  project_id: number;
  phase_id?: number;
  task_name: string;
  description?: string;
  estimated_duration?: number;
  start_date?: string;
  end_date?: string;
  earliest_start?: string;
  deadline?: string;
  status_code?: string;
  milestone_flag?: boolean;
  x_position?: number;
  y_position?: number;
  assignee?: Employee;
  phase?: ProjectPhase;
}

export interface WBSTask extends Task {
  checklist_progress: number;
  checklist_items: TaskChecklist[];
  dependencies: TaskDependency[];
}

export interface TaskDependency {
  task_id: number;
  depends_on_id: number;
  dependency_type: 'FS' | 'SS' | 'FF' | 'SF';
}

export interface TaskChecklist {
  checklist_id: number;
  task_id: number;
  item_name: string;
  is_done: boolean;
  sort_order: number;
}

export interface ScheduleCalculationResult {
  tasks: Task[];
  critical_path: number[];
  total_duration: number;
}

// PERT図ノード用の型
export interface PERTNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    task: Task;
    label: string;
  };
}