import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaFilter, FaEraser, FaUserPlus, FaTimes } from 'react-icons/fa';
import { Employee, ProjectMember } from '../types/index';
import { employeeAPI, projectAPI, projectMemberAPI } from '../utils/api';

interface EmployeeWithWorkload extends Employee {
  total_allocation: number;
  remaining_capacity: number;
  project_count: number;
}

const EmployeeList: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allMembers, setAllMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // フィルター・ページネーション状態
  const [searchTerm, setSearchTerm] = useState('');
  const [workloadFilter, setWorkloadFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const [newEmployee, setNewEmployee] = useState({
    employee_name: '',
    email: '',
    daily_work_hours: 8.0
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const [employeesData, projectsData] = await Promise.all([
        employeeAPI.getAll(),
        projectAPI.getAll()
      ]);
      
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
      console.error('社員データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 社員の工数計算
  const employeesWithWorkload = useMemo((): EmployeeWithWorkload[] => {
    return employees.map(employee => {
      const employeeAllocations = allMembers
        .filter(member => member.employee_id === employee.employee_id)
        .map(member => member.allocation_ratio || 0);
      
      const totalAllocation = employeeAllocations.reduce((sum, allocation) => sum + allocation, 0);
      const remainingCapacity = Math.max(0, 1.0 - totalAllocation);
      const projectCount = employeeAllocations.length;
      
      return {
        ...employee,
        total_allocation: totalAllocation,
        remaining_capacity: remainingCapacity,
        project_count: projectCount
      };
    });
  }, [employees, allMembers]);

  // フィルタリング（ソート順修正：新しい順→ID順）
  const filteredEmployees = useMemo(() => {
    return employeesWithWorkload
      .filter(employee => {
        const matchesSearch = !searchTerm || 
          employee.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.email.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesWorkload = true;
        if (workloadFilter) {
          switch (workloadFilter) {
            case 'available':
              matchesWorkload = employee.remaining_capacity >= 0.1;
              break;
            case 'busy':
              matchesWorkload = employee.remaining_capacity < 0.1;
              break;
            default:
              matchesWorkload = true;
          }
        }
        
        return matchesSearch && matchesWorkload;
      })
      .sort((a, b) => {
        // employee_idの降順（新しい社員が上に）
        return b.employee_id - a.employee_id;
      });
  }, [employeesWithWorkload, searchTerm, workloadFilter]);

  // ページネーション
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // バリデーション
      if (!newEmployee.employee_name.trim()) {
        alert('社員名は必須です。');
        return;
      }
      if (!newEmployee.email.trim()) {
        alert('メールアドレスは必須です。');
        return;
      }
      if (newEmployee.daily_work_hours <= 0 || newEmployee.daily_work_hours > 24) {
        alert('1日の稼働時間は0より大きく24以下で入力してください。');
        return;
      }

      await employeeAPI.create(newEmployee);
      setNewEmployee({ employee_name: '', email: '', daily_work_hours: 8.0 });
      setShowCreateForm(false);
      loadEmployees();
    } catch (error) {
      console.error('社員作成エラー:', error);
      alert('社員の登録に失敗しました。メールアドレスが重複している可能性があります。');
    }
  };

  const getWorkloadStatus = (remainingCapacity: number) => {
    if (remainingCapacity >= 0.1) return { text: '空きあり', color: '#4caf50' };
    return { text: '空きなし', color: '#d32f2f' };
  };

  // 社員行クリック処理
  const handleEmployeeRowClick = (employeeId: number) => {
    navigate(`/employees/${employeeId}`);
  };

  if (loading) return <div className="loading">読み込み中...</div>;

  return (
    <div className="employee-list">
      <div className="page-header">
        <h2>社員一覧</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FaUserPlus />
          新規社員登録
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
              社員名・メールアドレスで検索
            </label>
            <input
              type="text"
              placeholder="検索キーワードを入力..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
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
              工数状況
            </label>
            <select
              value={workloadFilter}
              onChange={(e) => {
                setWorkloadFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="">すべて</option>
              <option value="available">空きあり（0.1以上）</option>
              <option value="busy">空きなし（0.1以下）</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setSearchTerm('');
                setWorkloadFilter('');
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

      {/* 社員登録フォーム（step属性修正版） */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>新規社員登録</h3>
            <form onSubmit={handleCreateEmployee}>
              <div className="form-group">
                <label>社員名*</label>
                <input
                  type="text"
                  required
                  value={newEmployee.employee_name}
                  onChange={(e) => setNewEmployee({...newEmployee, employee_name: e.target.value})}
                  placeholder="例: 山田太郎"
                />
              </div>
              <div className="form-group">
                <label>メールアドレス*</label>
                <input
                  type="email"
                  required
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  placeholder="例: yamada@example.com"
                />
              </div>
              <div className="form-group">
                <label>1日の稼働時間</label>
                <input
                  type="number"
                  min="0.1"
                  max="24"
                  step="0.1"
                  value={newEmployee.daily_work_hours}
                  onChange={(e) => setNewEmployee({...newEmployee, daily_work_hours: Number(e.target.value)})}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  登録
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 社員一覧テーブル（操作カラム削除・行クリック対応） */}
      <div className="employee-table">
        <table>
          <thead>
            <tr>
              <th>社員名</th>
              <th>メールアドレス</th>
              <th>1日の稼働時間</th>
              <th>プロジェクト数</th>
              <th>割り当て工数</th>
              <th>残工数</th>
              <th>工数状況</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployees.map(employee => {
              const workloadStatus = getWorkloadStatus(employee.remaining_capacity);
              
              return (
                <tr 
                  key={employee.employee_id}
                  onClick={() => handleEmployeeRowClick(employee.employee_id)}
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
                  <td style={{ fontWeight: 500, color: '#1976d2' }}>{employee.employee_name}</td>
                  <td>{employee.email}</td>
                  <td>{employee.daily_work_hours || 8.0}時間/日</td>
                  <td>
                    <span style={{
                      backgroundColor: employee.project_count > 0 ? '#e3f2fd' : '#f5f5f5',
                      color: employee.project_count > 0 ? '#1976d2' : '#666',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}>
                      {employee.project_count}件
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 500,
                      color: employee.total_allocation > 0.8 ? '#d32f2f' : '#333'
                    }}>
                      {employee.total_allocation.toFixed(1)} / 1.0
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      color: workloadStatus.color
                    }}>
                      {employee.remaining_capacity.toFixed(1)}
                    </span>
                  </td>
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
              );
            })}
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
            {currentPage} / {totalPages} ページ ({filteredEmployees.length}名)
          </span>
        </div>
      )}

      {filteredEmployees.length === 0 && !loading && (
        <div className="empty-state">
          {searchTerm || workloadFilter ? 
            '条件に一致する社員がいません。' : 
            '社員が登録されていません。新規登録してください。'
          }
        </div>
      )}
    </div>
  );
};

export default EmployeeList;