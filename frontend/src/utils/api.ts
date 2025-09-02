import axios from 'axios';
import { Employee, Project, Task, WBSTask, TaskDependency, TaskChecklist, ScheduleCalculationResult, ProjectMember, ProjectPhase } from '../types/index';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============ Employee API ============
export const employeeAPI = {
  getAll: (): Promise<Employee[]> => 
    api.get('/employees').then(res => res.data),
  
  getById: (id: number): Promise<Employee> => 
    api.get(`/employees/${id}`).then(res => res.data),
  
  create: (employee: Omit<Employee, 'employee_id'>): Promise<Employee> => 
    api.post('/employees', employee).then(res => res.data),

  // 社員更新API（新規追加）
  update: (id: number, employee: Partial<Employee>): Promise<Employee> =>
    api.put(`/employees/${id}`, employee).then(res => res.data),
};

// ============ Project API ============
export const projectAPI = {
  getAll: (): Promise<Project[]> => 
    api.get('/projects').then(res => res.data),
  
  getById: (id: number): Promise<Project> => 
    api.get(`/projects/${id}`).then(res => res.data),
  
  create: (project: Omit<Project, 'project_id'>): Promise<Project> => 
    api.post('/projects', project).then(res => res.data),

  update: (id: number, project: Partial<Project>): Promise<Project> =>
    api.put(`/projects/${id}`, project).then(res => res.data),
};

// ============ ProjectPhase API ============ (新規追加)
export const projectPhaseAPI = {
  getPhases: (projectId: number): Promise<ProjectPhase[]> =>
    api.get(`/projects/${projectId}/phases`).then(res => res.data),
  
  create: (phase: Omit<ProjectPhase, 'phase_id'>): Promise<ProjectPhase> =>
    api.post('/project-phases', phase).then(res => res.data),
  
  update: (id: number, phase: Partial<ProjectPhase>): Promise<ProjectPhase> =>
    api.put(`/project-phases/${id}`, phase).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/project-phases/${id}`).then(res => res.data),
};

// ============ Project Member API ============
export const projectMemberAPI = {
  getMembers: (projectId: number): Promise<ProjectMember[]> =>
    api.get(`/projects/${projectId}/members`).then(res => res.data),
  
  addMember: (member: Omit<ProjectMember, 'employee'>): Promise<ProjectMember> =>
    api.post('/project-members', member).then(res => res.data),
  
  removeMember: (projectId: number, employeeId: number): Promise<void> =>
    api.delete(`/project-members/${projectId}/${employeeId}`).then(res => res.data),
  
  updateMember: (projectId: number, employeeId: number, updates: Partial<ProjectMember>): Promise<ProjectMember> =>
    api.put(`/project-members/${projectId}/${employeeId}`, updates).then(res => res.data),
};

// ============ Task API ============
export const taskAPI = {
  getProjectTasks: (projectId: number): Promise<WBSTask[]> => 
    api.get(`/projects/${projectId}/tasks`).then(res => res.data),
  
  create: (task: Omit<Task, 'task_id'> & { assignee_id?: number }): Promise<Task> => 
    api.post('/tasks', task).then(res => res.data),
  
  update: (id: number, task: Partial<Task>): Promise<Task> => 
    api.put(`/tasks/${id}`, task).then(res => res.data),
  
  createDependency: (dependency: TaskDependency): Promise<TaskDependency> => 
    api.post('/task-dependencies', dependency).then(res => res.data),
  
  deleteDependency: (taskId: number, dependsOnId: number): Promise<void> => 
    api.delete(`/task-dependencies/${taskId}/${dependsOnId}`).then(res => res.data),
};

// ============ Checklist API ============
export const checklistAPI = {
  getTaskChecklists: (taskId: number): Promise<TaskChecklist[]> => 
    api.get(`/tasks/${taskId}/checklists`).then(res => res.data),
  
  create: (checklist: Omit<TaskChecklist, 'checklist_id'>): Promise<TaskChecklist> => 
    api.post('/task-checklists', checklist).then(res => res.data),
  
  update: (id: number, checklist: Partial<TaskChecklist>): Promise<TaskChecklist> => 
    api.put(`/task-checklists/${id}`, checklist).then(res => res.data),
};

// ============ Schedule Calculation API ============
export const scheduleAPI = {
  calculateSchedule: (projectId: number): Promise<ScheduleCalculationResult> => 
    api.post(`/projects/${projectId}/calculate-schedule`).then(res => res.data),
};

// ============ Code Master API ============
export const codeAPI = {
  getCodes: (codeType: string): Promise<any[]> => 
    api.get(`/codes/${codeType}`).then(res => res.data),
};