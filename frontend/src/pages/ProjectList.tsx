import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaTimes, FaFilter, FaEraser } from 'react-icons/fa';
import { Project, Employee, ProjectMember } from '../types/index';
import { projectAPI, employeeAPI, projectMemberAPI } from '../utils/api';

interface MemberAllocation {
  employee_id: number;
  role_in_project: string;
  allocation_ratio: number;
}

interface EmployeeWorkload {
  employee_id: number;
  total_allocation: number;
  remaining_capacity: number;
}

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allMembers, setAllMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // フィルター・ページネーション状態
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const [newProject, setNewProject] = useState<Partial<Project>>({
    project_name: '',
    client_name: '',
    status_code: 'ACTIVE',
    budget: undefined,
    start_date: undefined,
    end_date: undefined
  });
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [memberAllocations, setMemberAllocations] = useState<Record<number, MemberAllocation>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsData, employeesData] = await Promise.all([
        projectAPI.getAll(),
        employeeAPI.getAll()
      ]);
      setProjects(projectsData);
      setEmployees(employeesData);
      
      // 全プロジェクトのメンバー情報を取得
      const allMembersData: ProjectMember[] = [];
      for (const project of projectsData) {
        try {
          const members = await projectMemberAPI.getMembers(project.project_id);
          allMembersData.push(...members);
        } catch (error) {
          console.error(`プロジェクト${project.project_id}のメンバー取得エラー:`, error);
        }
      }
      setAllMembers(allMembersData);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 社員の工数計算（修正版）
  const calculateEmployeeWorkloads = useMemo((): EmployeeWorkload[] => {
    return employees.map(employee => {
      const allocations = allMembers
        .filter(member => member.employee_id === employee.employee_id)
        .map(member => member.allocation_ratio || 0);
      
      const totalAllocation = allocations.reduce((sum, allocation) => sum + allocation, 0);
      const remainingCapacity = Math.max(0, 1.0 - totalAllocation);
      
      return {
        employee_id: employee.employee_id,
        total_allocation: totalAllocation,
        remaining_capacity: remainingCapacity
      };
    });
  }, [employees, allMembers]);

  // フィルタリング・ページネーション（ソート順修正：新しい順→ID順）
  const filteredProjects = useMemo(() => {
    return projects
      .filter(project => {
        const matchesSearch = !searchTerm || 
          project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (project.client_name && project.client_name.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = !statusFilter || project.status_code === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        // 作成日が遅い順（新しい順）→ ID順
        // project_idの降順（新しいプロジェクトが上に）
        return b.project_id - a.project_id;
      });
  }, [projects, searchTerm, statusFilter]);

  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProjects.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

  const handleMemberToggle = (employeeId: number) => {
    if (selectedMembers.includes(employeeId)) {
      // メンバーを削除
      setSelectedMembers(prev => prev.filter(id => id !== employeeId));
      setMemberAllocations(prev => {
        const { [employeeId]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      // メンバーを追加
      setSelectedMembers(prev => [...prev, employeeId]);
      setMemberAllocations(prev => ({
        ...prev,
        [employeeId]: {
          employee_id: employeeId,
          role_in_project: '',
          allocation_ratio: 0.1
        }
      }));
    }
  };

  const handleMemberAllocationChange = (employeeId: number, field: keyof MemberAllocation, value: string | number) => {
    setMemberAllocations(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value
      }
    }));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // バリデーション（開始日・終了日必須化）
      if (!newProject.project_name?.trim()) {
        alert('プロジェクト名は必須です。');
        return;
      }

      if (!newProject.start_date) {
        alert('開始日は必須です。');
        return;
      }

      if (!newProject.end_date) {
        alert('終了日は必須です。');
        return;
      }

      if (newProject.start_date && newProject.end_date) {
        const startDate = new Date(newProject.start_date);
        const endDate = new Date(newProject.end_date);
        if (startDate >= endDate) {
          alert('終了日は開始日より後の日付を指定してください。');
          return;
        }
      }

      // メンバーの工数チェック
      for (const employeeId of selectedMembers) {
        const allocation = memberAllocations[employeeId];
        const workload = calculateEmployeeWorkloads.find(w => w.employee_id === employeeId);
        
        if (workload && allocation.allocation_ratio > workload.remaining_capacity) {
          const employee = employees.find(e => e.employee_id === employeeId);
          alert(`${employee?.employee_name}の残工数（${workload.remaining_capacity.toFixed(1)}）を超える割り当てです。`);
          return;
        }
      }

      // プロジェクト作成
      const projectData = {
        ...newProject,
        budget: newProject.budget || undefined,
        start_date: newProject.start_date,
        end_date: newProject.end_date
      };

      const createdProject = await projectAPI.create(projectData as Omit<Project, 'project_id'>);
      
      // メンバー追加
      for (const employeeId of selectedMembers) {
        const allocation = memberAllocations[employeeId];
        await projectMemberAPI.addMember({
          project_id: createdProject.project_id,
          employee_id: employeeId,
          role_in_project: allocation.role_in_project || '',
          allocation_ratio: allocation.allocation_ratio || 0.1,
          join_date: new Date().toISOString().split('T')[0]
        });
      }
      
      // フォーム初期化
      setNewProject({
        project_name: '',
        client_name: '',
        status_code: 'ACTIVE',
        budget: undefined,
        start_date: undefined,
        end_date: undefined
      });
      setSelectedMembers([]);
      setMemberAllocations({});
      setShowCreateForm(false);
      loadData();
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      alert('プロジェクトの作成に失敗しました。');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  const getEmployeeWorkload = (employeeId: number) => {
    return calculateEmployeeWorkloads.find(w => w.employee_id === employeeId);
  };

  // プロジェクト行クリック処理
  const handleProjectRowClick = (projectId: number) => {
    navigate(`/projects/${projectId}`);
  };

  if (loading) return <div className="loading">読み込み中...</div>;

  return (
    <div className="project-list">
      <div className="page-header">
        <h2>プロジェクト一覧</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FaPlus />
          新規プロジェクト作成
        </button>
      </div>

      {/* フィルター・検索セクション */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
              <FaSearch style={{ marginRight: '0.5rem' }} />
              プロジェクト名・クライアント名で検索
            </label>
            <input
              type="text"
              placeholder="検索キーワードを入力..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // 検索時は1ページ目に戻る
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
              <FaFilter style={{ marginRight: '0.5rem' }} />
              ステータス
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1); // フィルター変更時は1ページ目に戻る
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="">すべて</option>
              <option value="ACTIVE">アクティブ</option>
              <option value="INACTIVE">非アクティブ</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FaEraser />
              クリア
            </button>
          </div>
        </div>
      </div>

      {/* 新規プロジェクト作成フォーム（残工数表示修正版） */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '1200px', width: '95%' }}>
            <h3>新規プロジェクト作成</h3>
            <form onSubmit={handleCreateProject}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* 左側：基本情報 */}
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#1976d2', borderBottom: '1px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                    基本情報
                  </h4>
                  
                  <div className="form-group">
                    <label>プロジェクト名 *</label>
                    <input
                      type="text"
                      required
                      value={newProject.project_name || ''}
                      onChange={(e) => setNewProject({...newProject, project_name: e.target.value})}
                      placeholder="例: ECサイト構築プロジェクト"
                    />
                  </div>

                  <div style={{ display: "flex" }}>
                    <div className="form-group" style={{ marginRight: "8px" }}>
                      <label>開始日 *</label>
                      <input
                        type="date"
                        required
                        value={newProject.start_date || ''}
                        onChange={(e) => setNewProject({...newProject, start_date: e.target.value || undefined})}
                      />
                    </div>
                    <div className="form-group">
                      <label>終了日 *</label>
                      <input
                        type="date"
                        required
                        value={newProject.end_date || ''}
                        onChange={(e) => setNewProject({...newProject, end_date: e.target.value || undefined})}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>プロジェクトマネージャー</label>
                    <select
                      value={newProject.manager_id || ''}
                      onChange={(e) => setNewProject({...newProject, manager_id: Number(e.target.value)})}
                    >
                      <option value="">未選択</option>
                      {employees.map(emp => {
                        const workload = getEmployeeWorkload(emp.employee_id);
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
                      value={newProject.client_name || ''}
                      onChange={(e) => setNewProject({...newProject, client_name: e.target.value})}
                      placeholder="例: 株式会社サンプル"
                    />
                  </div>

                  <div className="form-group">
                    <label>予算（円）</label>
                    <input
                      type="number"
                      min="0"
                      value={newProject.budget || ''}
                      onChange={(e) => setNewProject({...newProject, budget: e.target.value ? Number(e.target.value) : undefined})}
                      placeholder="5000000"
                    />
                  </div>

                  <div className="form-group">
                    <label>ステータス</label>
                    <select
                      value={newProject.status_code || 'ACTIVE'}
                      onChange={(e) => setNewProject({...newProject, status_code: e.target.value})}
                    >
                      <option value="ACTIVE">アクティブ</option>
                      <option value="INACTIVE">非アクティブ</option>
                    </select>
                  </div>
                </div>

                {/* 右側：プロジェクトメンバー（残工数表示修正版） */}
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#1976d2', borderBottom: '1px solid #e0e0e0', paddingBottom: '0.5rem' }}>
                    プロジェクトメンバー
                  </h4>
                  
                  <div style={{
                    height: '540px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '1rem',
                    backgroundColor: '#fafafa'
                  }}>
                    {employees.map(emp => {
                      const isSelected = selectedMembers.includes(emp.employee_id);
                      const allocation = memberAllocations[emp.employee_id];
                      const workload = getEmployeeWorkload(emp.employee_id); // 修正：正しい関数を使用
                      const remainingCapacity = workload?.remaining_capacity || 1.0;
                      
                      return (
                        <div key={emp.employee_id} style={{
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          padding: '1rem',
                          marginBottom: '1rem',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}>
                          {/* 社員情報ヘッダー */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            marginBottom: isSelected ? '1rem' : '0'
                          }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleMemberToggle(emp.employee_id)}
                              style={{
                                width: '20px',
                                transform: 'scale(1.2)',
                                accentColor: '#1976d2'
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontWeight: 600,
                                fontSize: '1rem',
                                color: '#333',
                                marginBottom: '0.25rem'
                              }}>
                                {emp.employee_name}
                              </div>
                              <div style={{
                                fontSize: '0.8rem',
                                color: remainingCapacity <= 0.1 ? '#d32f2f' : remainingCapacity <= 0.3 ? '#ff9800' : '#4caf50',
                                fontWeight: 500
                              }}>
                                残工数: {remainingCapacity.toFixed(1)}
                                {remainingCapacity <= 0.1 && (
                                  <span style={{ marginLeft: '0.5rem', color: '#d32f2f' }}>
                                    ⚠️ 工数不足
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 割り当て詳細（選択時のみ表示） */}
                          {isSelected && (
                            <div style={{
                              paddingTop: '1rem',
                              borderTop: '1px solid #e0e0e0',
                              display: 'grid',
                              gridTemplateColumns: '1fr 120px',
                              gap: '1rem',
                              alignItems: 'end'
                            }}>
                              <div>
                                <label style={{
                                  fontSize: '0.85rem',
                                  color: '#333',
                                  fontWeight: 500,
                                  marginBottom: '0.25rem',
                                  display: 'block'
                                }}>
                                  役割
                                </label>
                                <input
                                  type="text"
                                  placeholder="例: 開発者、テスター、PM"
                                  value={allocation?.role_in_project || ''}
                                  onChange={(e) => handleMemberAllocationChange(
                                    emp.employee_id, 
                                    'role_in_project', 
                                    e.target.value
                                  )}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem'
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label style={{
                                  fontSize: '0.85rem',
                                  color: '#333',
                                  fontWeight: 500,
                                  marginBottom: '0.25rem',
                                  display: 'block'
                                }}>
                                  割り当て工数
                                </label>
                                <input
                                  type="number"
                                  min="0.1"
                                  max={remainingCapacity}
                                  step="0.1"
                                  value={allocation?.allocation_ratio || 0.1}
                                  onChange={(e) => handleMemberAllocationChange(
                                    emp.employee_id, 
                                    'allocation_ratio', 
                                    Math.min(Number(e.target.value), remainingCapacity)
                                  )}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem'
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className="form-actions" style={{ marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary">
                  作成
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    setSelectedMembers([]);
                    setMemberAllocations({});
                  }}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* プロジェクト一覧テーブル（操作カラム削除・行クリック対応） */}
      <div className="project-table">
        <table>
          <thead>
            <tr>
              <th>プロジェクト名</th>
              <th>クライアント</th>
              <th>マネージャー</th>
              <th>予算</th>
              <th>期間</th>
              <th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProjects.map(project => (
              <tr 
                key={project.project_id}
                onClick={() => handleProjectRowClick(project.project_id)}
                style={{
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f7ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                <td style={{ fontWeight: 500, color: '#1976d2' }}>{project.project_name}</td>
                <td>{project.client_name || '-'}</td>
                <td>{project.manager?.employee_name || '-'}</td>
                <td>{project.budget ? formatCurrency(project.budget) : '-'}</td>
                <td>
                  {project.start_date && project.end_date ? (
                    `${project.start_date} ～ ${project.end_date}`
                  ) : project.start_date ? (
                    `${project.start_date} ～`
                  ) : project.end_date ? (
                    `～ ${project.end_date}`
                  ) : '-'}
                </td>
                <td>
                  <span className={`status ${project.status_code?.toLowerCase()}`}>
                    {project.status_code === 'ACTIVE' ? 'アクティブ' : '非アクティブ'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: 'white',
          borderRadius: '8px'
        }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === 1 ? '#e0e0e0' : '#1976d2',
              color: currentPage === 1 ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ＜
          </button>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: currentPage === page ? '#1976d2' : 'white',
                  color: currentPage === page ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  minWidth: '40px'
                }}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === totalPages ? '#e0e0e0' : '#1976d2',
              color: currentPage === totalPages ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            ＞
          </button>

          <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#666' }}>
            {currentPage} / {totalPages} ページ
          </span>
        </div>
      )}

      {filteredProjects.length === 0 && !loading && (
        <div className="empty-state">
          {searchTerm || statusFilter ? 
            '条件に一致するプロジェクトがありません。' : 
            'プロジェクトがありません。新規作成してください。'
          }
        </div>
      )}
    </div>
  );
};

export default ProjectList;