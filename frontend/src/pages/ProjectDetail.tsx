import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaEdit, FaPlus, FaUsers, FaProjectDiagram, FaInfo, FaNetworkWired, FaCalculator, FaExclamationTriangle, FaSave, FaTimes, FaTrash } from 'react-icons/fa';
import { Project, WBSTask, Employee, ProjectMember } from '../types/index';
import { projectAPI, taskAPI, employeeAPI, scheduleAPI, projectMemberAPI } from '../utils/api';
import WBSView from '../components/WBSView';
import PERTChart from '../components/PERTChart';

interface EmployeeWithWorkload extends Employee {
  total_allocation: number;
  remaining_capacity: number;
}

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allMembers, setAllMembers] = useState<ProjectMember[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'wbs' | 'pert'>('wbs');
  const [loading, setLoading] = useState(true);

  // スケジュール再計算ボタンの状態管理
  const [scheduleNeedsRecalculation, setScheduleNeedsRecalculation] = useState(false);
  const [isCalculatingSchedule, setIsCalculatingSchedule] = useState(false);

  // プロジェクト編集関連の状態
  const [showEditForm, setShowEditForm] = useState(false);
  const [editProject, setEditProject] = useState<Partial<Project>>({});

  // メンバー追加関連の状態
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMember, setNewMember] = useState({
    employee_id: '',
    role_in_project: '',
    allocation_ratio: 0.1
  });

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = useCallback(async () => {
    try {
      const [projectData, tasksData, employeesData, membersData, allProjectsData] = await Promise.all([
        projectAPI.getById(projectId),
        taskAPI.getProjectTasks(projectId),
        employeeAPI.getAll(),
        projectMemberAPI.getMembers(projectId),
        projectAPI.getAll()
      ]);
      
      setProject(projectData);
      setTasks(tasksData);
      setEmployees(employeesData);
      setMembers(membersData);
      setAllProjects(allProjectsData);
      setEditProject(projectData);
      
      // 全プロジェクトのメンバー情報を取得
      const allMembersData: ProjectMember[] = [];
      for (const proj of allProjectsData) {
        try {
          const members = await projectMemberAPI.getMembers(proj.project_id);
          allMembersData.push(...members);
        } catch (error) {
          console.error(`プロジェクト${proj.project_id}のメンバー取得エラー:`, error);
        }
      }
      setAllMembers(allMembersData);
      
    } catch (error) {
      console.error('プロジェクトデータ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 社員の工数計算
  const employeesWithWorkload = useMemo((): EmployeeWithWorkload[] => {
    return employees.map(employee => {
      const allocations = allMembers
        .filter(member => member.employee_id === employee.employee_id)
        .map(member => member.allocation_ratio || 0);
      
      const totalAllocation = allocations.reduce((sum, allocation) => sum + allocation, 0);
      const remainingCapacity = Math.max(0, 1.0 - totalAllocation);
      
      return {
        ...employee,
        total_allocation: totalAllocation,
        remaining_capacity: remainingCapacity
      };
    });
  }, [employees, allMembers]);

  // スケジュール変更を通知する関数
  const handleScheduleChange = useCallback(() => {
    console.log('Schedule change detected - enabling recalculation button');
    setScheduleNeedsRecalculation(true);
  }, []);

  // スケジュール再計算処理
  const handleCalculateSchedule = async () => {
    setIsCalculatingSchedule(true);
    try {
      console.log('Starting schedule calculation...');
      const result = await scheduleAPI.calculateSchedule(projectId);
      console.log('Schedule calculation result:', result);
      
      // データ再読み込み
      await loadProjectData();
      
      // 再計算完了後は再計算不要状態にする
      setScheduleNeedsRecalculation(false);
      
      alert(`スケジュール再計算が完了しました。\n総期間: ${result.total_duration}日\nクリティカルパス: ${result.critical_path.length}タスク`);
    } catch (error) {
      console.error('スケジュール計算エラー:', error);
      alert('スケジュール再計算に失敗しました。');
    } finally {
      setIsCalculatingSchedule(false);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    try {
      await taskAPI.create({
        ...taskData,
        project_id: projectId
      });
      
      // スケジュール変更通知
      handleScheduleChange();
      
      // データ更新
      await loadProjectData();
    } catch (error) {
      console.error('タスク作成エラー:', error);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // バリデーション（開始日・終了日必須化）
      if (!editProject.project_name?.trim()) {
        alert('プロジェクト名は必須です。');
        return;
      }

      if (!editProject.start_date) {
        alert('開始日は必須です。');
        return;
      }

      if (!editProject.end_date) {
        alert('終了日は必須です。');
        return;
      }

      if (editProject.start_date && editProject.end_date) {
        const startDate = new Date(editProject.start_date);
        const endDate = new Date(editProject.end_date);
        if (startDate >= endDate) {
          alert('終了日は開始日より後の日付を指定してください。');
          return;
        }
      }

      await projectAPI.update(projectId, editProject);
      
      // プロジェクト期間が変更された場合はスケジュール変更通知
      if (editProject.start_date !== project?.start_date || editProject.end_date !== project?.end_date) {
        handleScheduleChange();
      }
      
      setShowEditForm(false);
      await loadProjectData();
    } catch (error) {
      console.error('プロジェクト更新エラー:', error);
      alert('プロジェクトの更新に失敗しました。');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 工数チェック
      const employee = employeesWithWorkload.find(e => e.employee_id === Number(newMember.employee_id));
      if (employee && newMember.allocation_ratio > employee.remaining_capacity) {
        alert(`${employee.employee_name}の残工数（${employee.remaining_capacity.toFixed(1)}）を超える割り当てです。`);
        return;
      }

      await projectMemberAPI.addMember({
        project_id: projectId,
        employee_id: Number(newMember.employee_id),
        role_in_project: newMember.role_in_project,
        allocation_ratio: newMember.allocation_ratio,
        join_date: new Date().toISOString().split('T')[0]
      });
      
      setNewMember({ employee_id: '', role_in_project: '', allocation_ratio: 0.1 });
      setShowAddMemberForm(false);
      await loadProjectData();
    } catch (error) {
      console.error('メンバー追加エラー:', error);
      alert('メンバーの追加に失敗しました。');
    }
  };

  const handleRemoveMember = async (employeeId: number) => {
    if (window.confirm('このメンバーをプロジェクトから削除しますか？')) {
      try {
        await projectMemberAPI.removeMember(projectId, employeeId);
        await loadProjectData();
      } catch (error) {
        console.error('メンバー削除エラー:', error);
      }
    }
  };

  // WBS/PERTからの更新処理
  const handleUpdateTask = useCallback(async () => {
    try {
      const [tasksData] = await Promise.all([
        taskAPI.getProjectTasks(projectId)
      ]);
      setTasks(tasksData);
    } catch (error) {
      console.error('タスクデータ更新エラー:', error);
    }
  }, [projectId]);

  const getAvailableEmployees = () => {
    const memberIds = members.map(m => m.employee_id);
    return employeesWithWorkload.filter(emp => !memberIds.includes(emp.employee_id));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!project) return <div className="error">プロジェクトが見つかりません</div>;

  return (
    <div className="project-detail">
      {/* コンパクト化されたプロジェクト情報ヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to="/" 
            style={{
              color: '#666',
              fontSize: '0.9rem',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            プロジェクト一覧
          </Link>
          <div
            style={{
              color: '#666',
              fontSize: '0.6rem',
              textDecoration: 'none'
            }}
          >
            ＞
          </div>
          <h2 style={{ 
            margin: 0, 
            color: '#1976d2', 
            fontSize: '1.3rem',
            fontWeight: 600
          }}>
            {project.project_name}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* スケジュール変更通知インジケーター */}
          {scheduleNeedsRecalculation && (
            <span style={{ 
              color: '#ff9800', 
              fontSize: '0.8rem', 
              backgroundColor: '#fff3e0', 
              padding: '0.2rem 0.4rem', 
              borderRadius: '3px',
              border: '1px solid #ffcc02',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              <FaExclamationTriangle style={{ fontSize: '0.7rem' }} />
              要更新
            </span>
          )}
          <button 
            className="btn btn-primary"
            onClick={handleCalculateSchedule}
            disabled={!scheduleNeedsRecalculation || isCalculatingSchedule}
            style={{
              opacity: scheduleNeedsRecalculation ? 1 : 0.5,
              cursor: scheduleNeedsRecalculation ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              padding: '0.4rem 0.8rem'
            }}
          >
            <FaCalculator style={{ fontSize: '0.8rem' }} />
            {isCalculatingSchedule ? '計算中...' : 'スケジュール再計算'}
          </button>
        </div>
      </div>

      {/* コンパクト化されたタブ切り替え */}
      <div style={{
        display: 'flex',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 1.5rem'
      }}>
        <button 
          className={`tab-compact ${activeTab === 'wbs' ? 'active' : ''}`}
          onClick={() => setActiveTab('wbs')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: activeTab === 'wbs' ? '#1976d2' : '#666',
            borderBottom: activeTab === 'wbs' ? '2px solid #1976d2' : '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <FaProjectDiagram style={{ fontSize: '0.8rem' }} />
          WBS
        </button>
        <button 
          className={`tab-compact ${activeTab === 'pert' ? 'active' : ''}`}
          onClick={() => setActiveTab('pert')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: activeTab === 'pert' ? '#1976d2' : '#666',
            borderBottom: activeTab === 'pert' ? '2px solid #1976d2' : '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <FaNetworkWired style={{ fontSize: '0.8rem' }} />
          PERT図
        </button>
        <button 
          className={`tab-compact ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: activeTab === 'info' ? '#1976d2' : '#666',
            borderBottom: activeTab === 'info' ? '2px solid #1976d2' : '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <FaInfo style={{ fontSize: '0.8rem' }} />
          詳細
        </button>
        <button 
          className={`tab-compact ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: activeTab === 'members' ? '#1976d2' : '#666',
            borderBottom: activeTab === 'members' ? '2px solid #1976d2' : '2px solid transparent',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <FaUsers style={{ fontSize: '0.8rem' }} />
          メンバー
        </button>
      </div>

      {/* タブコンテンツ - 高さを最大化 */}
      <div style={{
        height: 'calc(100vh - 120px)', // ヘッダーとタブの高さを差し引いて最大化
        overflow: 'hidden'
      }}>
        {activeTab === 'info' && (
          <ProjectInfo 
            project={project} 
            onEdit={() => setShowEditForm(true)}
          />
        )}

        {activeTab === 'members' && (
          <div className="members-tab">
            <div className="members-header">
              <h3>プロジェクトメンバー</h3>
              <button 
                className="btn btn-primary"
                onClick={() => setShowAddMemberForm(true)}
                disabled={getAvailableEmployees().length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <FaPlus />
                メンバー追加
              </button>
            </div>

            {/* メンバー追加フォーム（step属性修正版） */}
            {showAddMemberForm && (
              <div className="modal-overlay">
                <div className="modal">
                  <h3>メンバー追加</h3>
                  <form onSubmit={handleAddMember}>
                    <div className="form-group">
                      <label>社員選択 *</label>
                      <select
                        required
                        value={newMember.employee_id}
                        onChange={(e) => setNewMember({...newMember, employee_id: e.target.value})}
                      >
                        <option value="">選択してください</option>
                        {getAvailableEmployees().map(emp => (
                          <option key={emp.employee_id} value={emp.employee_id}>
                            {emp.employee_name} (残工数: {emp.remaining_capacity.toFixed(1)})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>役割</label>
                      <input
                        type="text"
                        placeholder="例: 開発者、テスター、デザイナー"
                        value={newMember.role_in_project}
                        onChange={(e) =>
                          setNewMember({ ...newMember, role_in_project: e.target.value })
                        }
                        style={{
                          padding: "0.5rem", // 内側の余白
                          border: "1px solid #ccc", // 薄い枠線
                          borderRadius: "6px",      // 角丸
                          fontSize: "0.9rem",       // 少し大きめ文字
                          width: "100%",            // 横幅いっぱい（任意）
                          boxSizing: "border-box",  // paddingを含めてwidth計算
                          outline: "none",          // フォーカス時の青い枠を消す（任意）
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>割り当て工数（0.1 ～ 1.0）</label>
                      <input
                        type="number"
                        min="0.1"
                        max={newMember.employee_id ? 
                          getAvailableEmployees().find(e => e.employee_id === Number(newMember.employee_id))?.remaining_capacity || 1.0 : 
                          1.0
                        }
                        step="0.1"
                        value={newMember.allocation_ratio}
                        onChange={(e) => setNewMember({...newMember, allocation_ratio: Number(e.target.value)})}
                        style={{
                          padding: "0.5rem", // 内側の余白
                          border: "1px solid #ccc", // 薄い枠線
                          borderRadius: "6px",      // 角丸
                          fontSize: "0.9rem",       // 少し大きめ文字
                          width: "100%",            // 横幅いっぱい（任意）
                          boxSizing: "border-box",  // paddingを含めてwidth計算
                          outline: "none",          // フォーカス時の青い枠を消す（任意）
                        }}
                      />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary">
                        追加
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setShowAddMemberForm(false)}
                      >
                        キャンセル
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* メンバー一覧テーブル */}
            <MembersTable 
              members={members}
              onUpdateMember={async (projectId, employeeId, updates) => {
                try {
                  await projectMemberAPI.updateMember(projectId, employeeId, updates);
                  
                  // 稼働率変更時にスケジュール変更通知を呼び出す
                  if (updates.allocation_ratio !== undefined) {
                    handleScheduleChange();
                  }
                  
                  await loadProjectData();
                } catch (error) {
                  console.error('メンバー更新エラー:', error);
                  alert('メンバー情報の更新に失敗しました。');
                }
              }}
              onRemoveMember={handleRemoveMember}
              projectId={projectId}
            />

            {members.length === 0 && (
              <div className="empty-state">
                プロジェクトメンバーがいません。メンバーを追加してください。
              </div>
            )}
          </div>
        )}

        {activeTab === 'wbs' && (
          <WBSView 
            tasks={tasks} 
            employees={employees}
            members={members}
            project={project}
            onUpdateTask={handleUpdateTask}
            onScheduleChange={handleScheduleChange}
            projectStartDate={project.start_date}
            projectEndDate={project.end_date}
          />
        )}
        
        {activeTab === 'pert' && (
          <PERTChart 
            tasks={tasks}
            employees={employees}
            members={members}
            onUpdateTask={handleUpdateTask}
            onCreateTask={handleCreateTask}
            onCreateDependency={async (dep) => {
              await taskAPI.createDependency(dep);
              return;
            }}
            onScheduleChange={handleScheduleChange}
          />
        )}
      </div>

      {/* プロジェクト編集フォーム（新規作成フォームと同じデザイン） */}
      {showEditForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px', width: '90%' }}>
            <h3>プロジェクト編集</h3>
            <form onSubmit={handleEditProject}>
              <div>
                <div className="form-group">
                  <label>プロジェクト名 *</label>
                  <input
                    type="text"
                    required
                    value={editProject.project_name || ''}
                    onChange={(e) => setEditProject({...editProject, project_name: e.target.value})}
                    placeholder="例: ECサイト構築プロジェクト"
                  />
                </div>

                <div style={{ display: "flex" }}>
                  <div className="form-group" style={{ marginRight: "12px" }}>
                    <label>開始日 *</label>
                    <input
                      type="date"
                      required
                      value={editProject.start_date || ''}
                      onChange={(e) => setEditProject({...editProject, start_date: e.target.value || undefined})}
                    />
                  </div>
                  <div className="form-group">
                    <label>終了日 *</label>
                    <input
                      type="date"
                      required
                      value={editProject.end_date || ''}
                      onChange={(e) => setEditProject({...editProject, end_date: e.target.value || undefined})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>プロジェクトマネージャー</label>
                  <select
                    value={editProject.manager_id || ''}
                    onChange={(e) => setEditProject({...editProject, manager_id: Number(e.target.value)})}
                  >
                    <option value="">未選択</option>
                    {employees.map(emp => {
                      const workload = employeesWithWorkload.find(w => w.employee_id === emp.employee_id);
                      return (
                        <option key={emp.employee_id} value={emp.employee_id}>
                          {emp.employee_name} (残工数: {workload?.remaining_capacity.toFixed(1) || '1.0'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label>クライアント名</label>
                  <input
                    type="text"
                    value={editProject.client_name || ''}
                    onChange={(e) => setEditProject({...editProject, client_name: e.target.value})}
                    placeholder="例: 株式会社サンプル"
                  />
                </div>

                <div className="form-group">
                  <label>予算（円）</label>
                  <input
                    type="number"
                    min="0"
                    value={editProject.budget || ''}
                    onChange={(e) => setEditProject({...editProject, budget: e.target.value ? Number(e.target.value) : undefined})}
                    placeholder="5000000"
                  />
                </div>

                <div className="form-group">
                  <label>ステータス</label>
                  <select
                    value={editProject.status_code || 'ACTIVE'}
                    onChange={(e) => setEditProject({...editProject, status_code: e.target.value})}
                  >
                    <option value="ACTIVE">アクティブ</option>
                    <option value="INACTIVE">非アクティブ</option>
                  </select>
                </div>
              </div>
              
              <div className="form-actions" style={{ marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary">
                  更新
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEditForm(false)}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// メンバーテーブルコンポーネント（インライン編集機能付き）
const MembersTable: React.FC<{
  members: ProjectMember[];
  onUpdateMember: (projectId: number, employeeId: number, updates: Partial<ProjectMember>) => Promise<void>;
  onRemoveMember: (employeeId: number) => void;
  projectId: number;
}> = ({ members, onUpdateMember, onRemoveMember, projectId }) => {
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    role_in_project: string;
    allocation_ratio: number;
  }>({ role_in_project: '', allocation_ratio: 1.0 });

  const handleStartEdit = (member: ProjectMember) => {
    setEditingMember(member.employee_id);
    setEditData({
      role_in_project: member.role_in_project || '',
      allocation_ratio: member.allocation_ratio || 1.0
    });
  };

  const handleSaveEdit = async (employeeId: number) => {
    try {
      const originalMember = members.find(m => m.employee_id === employeeId);
      const allocationChanged = originalMember && originalMember.allocation_ratio !== editData.allocation_ratio;
      
      await onUpdateMember(projectId, employeeId, editData);
      setEditingMember(null);
    } catch (error) {
      console.error('メンバー更新エラー:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setEditData({ role_in_project: '', allocation_ratio: 1.0 });
  };

  return (
    <div className="members-table">
      <table>
        <thead>
          <tr>
            <th>社員名</th>
            <th>メールアドレス</th>
            <th>役割</th>
            <th>稼働率</th>
            <th>参加日</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <tr key={member.employee_id}>
              <td>{member.employee?.employee_name}</td>
              <td>{member.employee?.email}</td>
              <td>
                {editingMember === member.employee_id ? (
                  <input
                    type="text"
                    value={editData.role_in_project}
                    onChange={(e) => setEditData({...editData, role_in_project: e.target.value})}
                    placeholder="例: 開発者、テスター"
                    style={{
                      padding: "0.5rem", // 内側の余白
                      border: "1px solid #ccc", // 薄い枠線
                      borderRadius: "6px",      // 角丸
                      fontSize: "0.9rem",       // 少し大きめ文字
                      width: "100%",            // 横幅いっぱい（任意）
                      boxSizing: "border-box",  // paddingを含めてwidth計算
                      outline: "none",          // フォーカス時の青い枠を消す（任意）
                    }}
                  />
                ) : (
                  member.role_in_project || '-'
                )}
              </td>
              <td>
                {editingMember === member.employee_id ? (
                  <input
                    type="number"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={editData.allocation_ratio}
                    onChange={(e) => setEditData({...editData, allocation_ratio: Number(e.target.value)})}
                    style={{
                      padding: "0.5rem", // 内側の余白
                      border: "1px solid #ccc", // 薄い枠線
                      borderRadius: "6px",      // 角丸
                      fontSize: "0.9rem",       // 少し大きめ文字
                      width: "100%",            // 横幅いっぱい（任意）
                      boxSizing: "border-box",  // paddingを含めてwidth計算
                      outline: "none",          // フォーカス時の青い枠を消す（任意）
                    }}
                  />
                ) : (
                  <span>
                    {((member.allocation_ratio || 1.0) * 100).toFixed(0)}%
                  </span>
                )}
              </td>
              <td>{member.join_date || '-'}</td>
              <td>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {editingMember === member.employee_id ? (
                    <>
                      <button
                        className="btn btn-small btn-primary"
                        onClick={() => handleSaveEdit(member.employee_id)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        保存
                      </button>
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={handleCancelEdit}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={() => handleStartEdit(member)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        編集
                      </button>
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => onRemoveMember(member.employee_id)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        削除
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// プロジェクト詳細情報コンポーネント（テーブル風UI）
const ProjectInfo: React.FC<{ project: Project; onEdit: () => void }> = ({ project, onEdit }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  const durationText = (() => {
    if (project.start_date && project.end_date) {
      const start = new Date(project.start_date);
      const end = new Date(project.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return `${days}日間`;
    }
    return '-';
  })();

  const statusClass = project.status_code?.toLowerCase() || 'active';
  const statusLabel = project.status_code === 'ACTIVE' ? 'アクティブ' : '非アクティブ';

  return (
    <div className="project-info-tab">
      <div className="info-section">
        <h3>
          基本情報
          <button 
            className="btn btn-secondary"
            onClick={onEdit}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FaEdit style={{ marginRight: '0.5rem' }} />
            編集
          </button>
        </h3>

        <div className="info-table" role="region" aria-label="プロジェクト基本情報">
          <table aria-describedby="project-basic-info">
            <tbody id="project-basic-info">
              <tr>
                <th scope="row">プロジェクト名</th>
                <td className="value-mono">{project.project_name}</td>
              </tr>
              <tr>
                <th scope="row">クライアント名</th>
                <td>{project.client_name || '-'}</td>
              </tr>
              <tr>
                <th scope="row">プロジェクトマネージャー</th>
                <td>{project.manager?.employee_name || '-'}</td>
              </tr>
              <tr>
                <th scope="row">予算</th>
                <td className="inline-badge">
                  {project.budget ? <span className="value-mono">{formatCurrency(project.budget)}</span> : '-'}
                </td>
              </tr>
              <tr>
                <th scope="row">開始日</th>
                <td className="value-mono">{project.start_date || '-'}</td>
              </tr>
              <tr>
                <th scope="row">終了日</th>
                <td className="value-mono">{project.end_date || '-'}</td>
              </tr>
              <tr>
                <th scope="row">期間</th>
                <td className="inline-badge">
                  <span>{durationText}</span>
                  {project.start_date && project.end_date && (
                    <small>（{project.start_date} 〜 {project.end_date}）</small>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">ステータス</th>
                <td>
                  <span className={`status ${statusClass}`}>{statusLabel}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;