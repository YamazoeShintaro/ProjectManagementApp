import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaArrowLeft, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { Employee, Project, ProjectMember } from '../types/index';
import { employeeAPI, projectAPI, projectMemberAPI } from '../utils/api';

const EmployeeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const employeeId = Number(id);
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allMembers, setAllMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editData, setEditData] = useState({
    employee_name: '',
    email: '',
    daily_work_hours: 8.0
  });

  useEffect(() => {
    loadEmployeeData();
  }, [employeeId]);

  const loadEmployeeData = async () => {
    try {
      const [employeeData, projectsData] = await Promise.all([
        employeeAPI.getById(employeeId),
        projectAPI.getAll()
      ]);
      
      setEmployee(employeeData);
      setAllProjects(projectsData);
      setEditData({
        employee_name: employeeData.employee_name,
        email: employeeData.email,
        daily_work_hours: employeeData.daily_work_hours || 8.0
      });
      
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
      console.error('社員データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 社員の参加プロジェクト情報を計算
  const employeeProjects = useMemo(() => {
    return allMembers
      .filter(member => member.employee_id === employeeId)
      .map(member => {
        const project = allProjects.find(p => p.project_id === member.project_id);
        return {
          ...member,
          project
        };
      })
      .filter(item => item.project); // プロジェクトが見つからない場合を除外
  }, [allMembers, allProjects, employeeId]);

  // 工数計算
  const workloadSummary = useMemo(() => {
    const totalAllocation = employeeProjects.reduce((sum, proj) => sum + (proj.allocation_ratio || 0), 0);
    const remainingCapacity = Math.max(0, 1.0 - totalAllocation);
    
    return {
      totalAllocation,
      remainingCapacity,
      projectCount: employeeProjects.length
    };
  }, [employeeProjects]);

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // バリデーション
      if (!editData.employee_name.trim()) {
        alert('社員名は必須です。');
        return;
      }
      if (!editData.email.trim()) {
        alert('メールアドレスは必須です。');
        return;
      }
      if (editData.daily_work_hours <= 0 || editData.daily_work_hours > 24) {
        alert('1日の稼働時間は0より大きく24以下で入力してください。');
        return;
      }

      // 社員情報更新API呼び出し
      await employeeAPI.update(employeeId, editData);
      
      setShowEditForm(false);
      await loadEmployeeData();
      
      alert('社員情報を更新しました。');
    } catch (error: any) {
      console.error('社員更新エラー:', error);
      
      // エラーメッセージの詳細表示
      if (error.response?.status === 400 && error.response?.data?.detail === 'Email already exists') {
        alert('このメールアドレスは既に使用されています。');
      } else if (error.response?.data?.detail) {
        alert(`社員情報の更新に失敗しました: ${error.response.data.detail}`);
      } else {
        alert('社員情報の更新に失敗しました。');
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  const getWorkloadStatus = (remainingCapacity: number) => {
    if (remainingCapacity >= 0.1) return { text: '空きあり', color: '#4caf50' };
    return { text: '空きなし', color: '#d32f2f' };
  };

  // プロジェクト行クリック処理
  const handleProjectRowClick = (projectId: number) => {
    navigate(`/projects/${projectId}`);
  };

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!employee) return <div className="error">社員が見つかりません</div>;

  const workloadStatus = getWorkloadStatus(workloadSummary.remainingCapacity);

  return (
    <div className="employee-detail">
      {/* 社員編集フォーム */}
      {showEditForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>社員情報編集</h3>
            <form onSubmit={handleEditEmployee}>
              <div className="form-group">
                <label>社員名*</label>
                <input
                  type="text"
                  required
                  value={editData.employee_name}
                  onChange={(e) => setEditData({...editData, employee_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>メールアドレス*</label>
                <input
                  type="email"
                  required
                  value={editData.email}
                  onChange={(e) => setEditData({...editData, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>1日の稼働時間</label>
                <input
                  type="number"
                  min="0.1"
                  max="24"
                  step="0.1"
                  value={editData.daily_work_hours}
                  onChange={(e) => setEditData({...editData, daily_work_hours: Number(e.target.value)})}
                />
              </div>
              <div className="form-actions">
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* 基本情報 */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1.5rem', 
            color: '#1976d2',
            borderBottom: '2px solid #e0e0e0',
            paddingBottom: '0.5rem'
          }}>
            <h3 style={{ display: 'flex', alignItems: 'center' }}>
              基本情報
            </h3>

            <button 
              className="btn btn-primary"
              onClick={() => setShowEditForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FaEdit />
              編集
            </button>
          </div>
          
          <div className="info-table">
            <table>
              <tbody>
                <tr>
                  <th>社員ID</th>
                  <td>{employee.employee_id}</td>
                </tr>
                <tr>
                  <th>社員名</th>
                  <td style={{ fontWeight: 500 }}>{employee.employee_name}</td>
                </tr>
                <tr>
                  <th>メールアドレス</th>
                  <td>{employee.email}</td>
                </tr>
                <tr>
                  <th>1日の稼働時間</th>
                  <td>{employee.daily_work_hours || 8.0}時間</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 工数状況 */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            marginBottom: '1.5rem', 
            color: '#1976d2',
            borderBottom: '2px solid #e0e0e0',
            paddingBottom: '0.5rem'
          }}>
            工数状況
          </h3>
          
          <div className="info-table">
            <table>
              <tbody>
                <tr>
                  <th>参画プロジェクト数</th>
                  <td>
                    <span style={{
                      backgroundColor: workloadSummary.projectCount > 0 ? '#e3f2fd' : '#f5f5f5',
                      color: workloadSummary.projectCount > 0 ? '#1976d2' : '#666',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: 500
                    }}>
                      {workloadSummary.projectCount}件
                    </span>
                  </td>
                </tr>
                <tr>
                  <th>総割り当て工数</th>
                  <td>
                    <span style={{
                      fontWeight: 500,
                      color: workloadSummary.totalAllocation > 0.8 ? '#d32f2f' : '#333'
                    }}>
                      {workloadSummary.totalAllocation.toFixed(1)} / 1.0
                    </span>
                  </td>
                </tr>
                <tr>
                  <th>残工数</th>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      color: workloadStatus.color
                    }}>
                      {workloadSummary.remainingCapacity.toFixed(1)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th>工数状況</th>
                  <td>
                    <span style={{
                      backgroundColor: workloadStatus.color,
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}>
                      {workloadStatus.text}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 参加プロジェクト一覧（操作カラム削除・行クリック遷移対応） */}
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        marginTop: '2rem',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ 
          marginBottom: '1.5rem', 
          color: '#1976d2',
          borderBottom: '2px solid #e0e0e0',
          paddingBottom: '0.5rem'
        }}>
          参画プロジェクト
        </h3>

        {employeeProjects.length > 0 ? (
          <div className="projects-table">
            <table>
              <thead>
                <tr>
                  <th>プロジェクト名</th>
                  <th>クライアント名</th>
                  <th>役割</th>
                  <th>稼働率</th>
                  <th>参加期間</th>
                  <th>プロジェクト状況</th>
                </tr>
              </thead>
              <tbody>
                {employeeProjects.map((proj) => (
                  <tr 
                    key={proj.project_id}
                    onClick={() => handleProjectRowClick(proj.project_id)}
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
                    <td style={{ fontWeight: 500, color: '#1976d2' }}>
                      {proj.project?.project_name}
                    </td>
                    <td>{proj.project?.client_name || '-'}</td>
                    <td>{proj.role_in_project || '-'}</td>
                    <td>
                      <span style={{
                        fontWeight: 500,
                        color: (proj.allocation_ratio || 0) > 0.8 ? '#d32f2f' : '#333'
                      }}>
                        {((proj.allocation_ratio || 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.9rem' }}>
                        <div>参加: {proj.join_date || '不明'}</div>
                        {proj.leave_date && (
                          <div>退任: {proj.leave_date}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status ${proj.project?.status_code?.toLowerCase()}`}>
                        {proj.project?.status_code === 'ACTIVE' ? 'アクティブ' : '非アクティブ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            この社員はまだプロジェクトに参加していません。
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetail;