import React, { useState, useMemo, useRef, useCallback } from 'react';
import { FaPlus, FaFilePdf, FaTimes, FaEdit, FaSave, FaTasks } from 'react-icons/fa';
import { WBSTask, Employee, ProjectMember, Project, TaskChecklist } from '../types/index';
import { taskAPI, checklistAPI } from '../utils/api';
import { exportWBSToPDF } from '../utils/pdf-utils';

interface Props {
  tasks: WBSTask[];
  employees: Employee[];
  members: ProjectMember[];
  project?: Project;
  onUpdateTask: () => void;
  onScheduleChange: () => void;
  projectStartDate?: string;
  projectEndDate?: string;
}

const WBSView: React.FC<Props> = ({ 
  tasks, 
  employees, 
  members,
  project,
  onUpdateTask, 
  onScheduleChange,
  projectStartDate, 
  projectEndDate 
}) => {
  const [selectedTask, setSelectedTask] = useState<WBSTask | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [newTask, setNewTask] = useState({
    task_name: '',
    description: '',
    estimated_duration: 1,
    task_category: '', // フェーズの代わりにカテゴリとして使用
    assignee_id: '',
    milestone_flag: false
  });

  // チェックリスト管理用の状態
  const [checklistItems, setChecklistItems] = useState<TaskChecklist[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editingChecklist, setEditingChecklist] = useState<number | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');

  // タスク詳細パネル用の状態
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    task_name: '',
    category: '',
    description: '',
    estimated_duration: 1,
    status_code: 'NOT_STARTED',
    assignee_id: ''
  });

  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);

  // 既存タスクからカテゴリを抽出
  const existingCategories = useMemo(() => {
    const categories = new Set<string>();
    tasks.forEach(task => {
      if (task.description && task.description.startsWith('[') && task.description.includes(']')) {
        const match = task.description.match(/^\[([^\]]+)\]/);
        if (match) {
          categories.add(match[1]);
        }
      }
    });
    return Array.from(categories).sort();
  }, [tasks]);

  // カテゴリ色を生成
  const getCategoryColor = (category: string) => {
    const colors = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#d32f2f', '#0097a7', '#5d4037'];
    const hash = category.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // タスクからカテゴリを抽出
  const getTaskCategory = (task: WBSTask) => {
    if (task.description && task.description.startsWith('[') && task.description.includes(']')) {
      const match = task.description.match(/^\[([^\]]+)\]/);
      return match ? match[1] : null;
    }
    return null;
  };

  // 説明からカテゴリ部分を除去
  const getDescriptionWithoutCategory = (description: string) => {
    if (description && description.startsWith('[') && description.includes(']')) {
      const match = description.match(/^\[([^\]]+)\]\s*(.*)/);
      return match ? match[2] : description;
    }
    return description;
  };

  // 選択されたタスクのチェックリストを読み込み
  React.useEffect(() => {
    if (selectedTask) {
      setChecklistItems([...selectedTask.checklist_items].sort((a, b) => a.sort_order - b.sort_order));
      
      // 編集データを初期化
      const taskCategory = getTaskCategory(selectedTask);
      const descriptionWithoutCategory = getDescriptionWithoutCategory(selectedTask.description || '');
      
      setEditData({
        task_name: selectedTask.task_name,
        category: taskCategory || '',
        description: descriptionWithoutCategory,
        estimated_duration: selectedTask.estimated_duration || 1,
        status_code: selectedTask.status_code || 'NOT_STARTED',
        assignee_id: selectedTask.assignee?.employee_id?.toString() || ''
      });
      setIsEditing(false);
    }
  }, [selectedTask]);

  // プロジェクトメンバーのみをフィルタ
  const projectMembers = useMemo(() => {
    return members.map(member => ({
      ...member.employee!,
      allocation_ratio: member.allocation_ratio || 1.0
    }));
  }, [members]);

  // タスクをソート（修正版：開始日優先）
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // 1. 開始日でソート（早い順）
      const startDateA = a.start_date ? new Date(a.start_date) : null;
      const startDateB = b.start_date ? new Date(b.start_date) : null;
      
      if (startDateA && startDateB) {
        const startDiff = startDateA.getTime() - startDateB.getTime();
        if (startDiff !== 0) {
          return startDiff;
        }
        
        // 2. 開始日が同じ場合、終了日でソート（早い順）
        const endDateA = a.end_date ? new Date(a.end_date) : null;
        const endDateB = b.end_date ? new Date(b.end_date) : null;
        
        if (endDateA && endDateB) {
          const endDiff = endDateA.getTime() - endDateB.getTime();
          if (endDiff !== 0) {
            return endDiff;
          }
        } else if (endDateA && !endDateB) {
          return -1;
        } else if (!endDateA && endDateB) {
          return 1;
        }
        
        // 3. 開始日・終了日が同じ場合、タスクIDでソート
        return a.task_id - b.task_id;
      }
      
      // 開始日がない場合の処理
      if (startDateA && !startDateB) return -1;
      if (!startDateA && startDateB) return 1;
      
      // 両方開始日がない場合、終了日でソート
      const endDateA = a.end_date ? new Date(a.end_date) : null;
      const endDateB = b.end_date ? new Date(b.end_date) : null;
      
      if (endDateA && endDateB) {
        const endDiff = endDateA.getTime() - endDateB.getTime();
        if (endDiff !== 0) {
          return endDiff;
        }
      } else if (endDateA && !endDateB) {
        return -1;
      } else if (!endDateA && endDateB) {
        return 1;
      }
      
      // 最終的にタスクIDでソート
      return a.task_id - b.task_id;
    });
  }, [tasks]);

  // 日付範囲を計算
  const dateRange = useMemo(() => {
    let startDate: Date;
    let endDate: Date;
    let projectEndDateObj: Date | null = null;
    
    if (projectStartDate && projectEndDate) {
      startDate = new Date(projectStartDate);
      endDate = new Date(projectEndDate);
      projectEndDateObj = new Date(projectEndDate);
    } else if (sortedTasks.length > 0) {
      const allDates = sortedTasks.flatMap(task => [task.start_date, task.end_date, task.earliest_start, task.deadline])
        .filter(Boolean)
        .map(dateStr => new Date(dateStr!));
      
      if (allDates.length > 0) {
        startDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        endDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      } else {
        startDate = new Date();
        endDate = new Date();
        endDate.setDate(startDate.getDate() + 30);
      }
    } else {
      startDate = new Date();
      endDate = new Date();
      endDate.setDate(startDate.getDate() + 30);
    }
    
    // タスクの最大終了日を取得
    const taskEndDates = sortedTasks
      .map(task => task.end_date ? new Date(task.end_date) : null)
      .filter((date): date is Date => date !== null);
    
    const maxTaskEndDate = taskEndDates.length > 0
      ? taskEndDates.reduce((max, date) => date > max ? date : max, endDate)
      : endDate;
    
    // プロジェクト終了日を超えるタスクがある場合、表示範囲を拡張
    if (projectEndDateObj && maxTaskEndDate > projectEndDateObj) {
      endDate = maxTaskEndDate;
    }
    
    const adjustedStartDate = new Date(startDate);
    adjustedStartDate.setDate(startDate.getDate() - 7);
    
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(endDate.getDate() + 7);
    
    const dates = [];
    const currentDate = new Date(adjustedStartDate);
    while (currentDate <= adjustedEndDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }, [sortedTasks, projectStartDate, projectEndDate]);

  const today = new Date().toDateString();

  // タスク期間のポジション計算
  const getTaskPosition = (task: WBSTask) => {
    if (!task.start_date || !task.end_date) return null;
    
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    
    const startIndex = dateRange.findIndex(date => 
      date.toDateString() === taskStart.toDateString()
    );
    
    const durationDays = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (startIndex === -1) return null;
    
    return {
      left: startIndex * 30,
      width: Math.max(durationDays * 30, 25)
    };
  };

  // プロジェクト期間外かどうかを判定
  const isOutsideProjectPeriod = (date: Date) => {
    if (!projectStartDate || !projectEndDate) return false;
    
    const projectStart = new Date(projectStartDate);
    const projectEnd = new Date(projectEndDate);
    
    return date < projectStart || date > projectEnd;
  };

  // PDF出力処理
  const handleExportPDF = async () => {
    if (!ganttContainerRef.current) {
      alert('ガントチャートが表示されていません。');
      return;
    }

    if (sortedTasks.length === 0) {
      alert('出力するタスクがありません。');
      return;
    }

    setIsExportingPDF(true);
    
    try {
      await exportWBSToPDF(ganttContainerRef.current, {
        title: project ? `${project.project_name} - WBSガントチャート` : 'WBSガントチャート',
        project: project,
        orientation: 'landscape',
        format: 'a3'
      });
    } catch (error) {
      console.error('PDF出力エラー:', error);
      alert('PDF出力に失敗しました。詳細はコンソールを確認してください。');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // スクロール同期
  const handleLeftScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (rightBodyRef.current) {
      rightBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  const handleRightScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (leftBodyRef.current) {
      leftBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    
    if (rightHeaderRef.current) {
      rightHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  const handleHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (rightBodyRef.current) {
      rightBodyRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  // ステータス更新
  const handleStatusUpdate = async (taskId: number, newStatus: string) => {
    try {
      await taskAPI.update(taskId, { status_code: newStatus });
      onScheduleChange();
      await onUpdateTask();
    } catch (error) {
      console.error('ステータス更新エラー:', error);
    }
  };

  // タスク作成（必須項目バリデーション追加）
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // バリデーション（予定工数・担当者必須化）
      if (!newTask.task_name.trim()) {
        alert('タスク名は必須です。');
        return;
      }

      if (!newTask.estimated_duration || newTask.estimated_duration <= 0) {
        alert('予定工数は必須です。0より大きい値を入力してください。');
        return;
      }

      if (!newTask.assignee_id) {
        alert('担当者は必須です。担当者を選択してください。');
        return;
      }

      const projectId = sortedTasks.length > 0 ? sortedTasks[0].project_id : project!.project_id;
      
      // カテゴリを説明の先頭に追加
      const description = newTask.task_category 
        ? `[${newTask.task_category}] ${newTask.description}`
        : newTask.description;
      
      await taskAPI.create({
        ...newTask,
        description,
        project_id: projectId,
        assignee_id: newTask.assignee_id ? Number(newTask.assignee_id) : undefined
      });
      
      onScheduleChange();
      
      setNewTask({
        task_name: '',
        description: '',
        estimated_duration: 1,
        task_category: '',
        assignee_id: '',
        milestone_flag: false
      });
      setShowCreateForm(false);
      
      await onUpdateTask();
    } catch (error) {
      console.error('タスク作成エラー:', error);
      alert('タスクの作成に失敗しました。');
    }
  };

  // タスク詳細更新（必須項目バリデーション追加）
  const handleSaveTask = async () => {
    if (!selectedTask) return;
    
    try {
      // バリデーション（予定工数・担当者必須化）
      if (!editData.task_name.trim()) {
        alert('タスク名は必須です。');
        return;
      }

      if (!editData.estimated_duration || editData.estimated_duration <= 0) {
        alert('予定工数は必須です。0より大きい値を入力してください。');
        return;
      }

      if (!editData.assignee_id) {
        alert('担当者は必須です。担当者を選択してください。');
        return;
      }

      // カテゴリを説明の先頭に追加
      const finalDescription = editData.category.trim() 
        ? `[${editData.category.trim()}] ${editData.description}`
        : editData.description;
      
      await taskAPI.update(selectedTask.task_id, {
        task_name: editData.task_name,
        description: finalDescription,
        estimated_duration: editData.estimated_duration,
        status_code: editData.status_code,
        ...(editData.assignee_id && { assignee_id: Number(editData.assignee_id) })
      });
      
      setIsEditing(false);
      onScheduleChange();
      await onUpdateTask();
    } catch (error) {
      console.error('タスク更新エラー:', error);
      alert('タスクの更新に失敗しました。');
    }
  };

  // チェックリスト追加
  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim() || !selectedTask) return;
    
    try {
      const newItem = await checklistAPI.create({
        task_id: selectedTask.task_id,
        item_name: newChecklistItem,
        is_done: false,
        sort_order: checklistItems.length
      });
      
      setChecklistItems(prev => [...prev, newItem]);
      setNewChecklistItem('');
      
      await onUpdateTask();
    } catch (error) {
      console.error('チェックリスト作成エラー:', error);
      alert('チェックリストアイテムの追加に失敗しました。');
    }
  };

  // チェックリスト状態切り替え
  const handleChecklistToggle = async (checklistId: number, isDone: boolean) => {
    try {
      setChecklistItems(prev => 
        prev.map(item => 
          item.checklist_id === checklistId 
            ? { ...item, is_done: isDone }
            : item
        )
      );
      
      await checklistAPI.update(checklistId, { is_done: isDone });
      await onUpdateTask();
    } catch (error) {
      console.error('チェックリスト更新エラー:', error);
      
      setChecklistItems(prev => 
        prev.map(item => 
          item.checklist_id === checklistId 
            ? { ...item, is_done: !isDone }
            : item
        )
      );
      
      alert('チェックリストの更新に失敗しました。');
    }
  };

  // チェックリスト編集開始
  const handleStartEditChecklist = (item: TaskChecklist) => {
    setEditingChecklist(item.checklist_id);
    setEditingChecklistText(item.item_name);
  };

  // チェックリスト編集保存
  const handleSaveEditChecklist = async (checklistId: number) => {
    try {
      await checklistAPI.update(checklistId, { item_name: editingChecklistText });
      
      setChecklistItems(prev => 
        prev.map(item => 
          item.checklist_id === checklistId 
            ? { ...item, item_name: editingChecklistText }
            : item
        )
      );
      
      setEditingChecklist(null);
      setEditingChecklistText('');
      
      await onUpdateTask();
    } catch (error) {
      console.error('チェックリスト編集エラー:', error);
      alert('チェックリストの編集に失敗しました。');
    }
  };

  // タスク選択処理
  const handleTaskSelect = (task: WBSTask) => {
    setSelectedTask(selectedTask?.task_id === task.task_id ? null : task);
  };

  // パネル外クリック処理
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // パネル内クリックは無視
    if (e.target !== e.currentTarget) return;
    setSelectedTask(null);
  };

  // 曜日を日本語で取得
  const getDayOfWeek = (date: Date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  // 進捗率に応じた色
  const getProgressColor = (progress: number, status: string) => {
    if (status === 'COMPLETED') return '#4CAF50';
    if (status === 'IN_PROGRESS') return '#FF9800';
    return '#2196F3';
  };

  // 月の変わり目を検出
  const isMonthStart = (date: Date, index: number) => {
    if (index === 0) return true;
    return date.getDate() === 1;
  };

  const ROW_HEIGHT = 45;
  const LEFT_COLUMNS_WIDTH = 570;
  const DATE_CELL_WIDTH = 30;
  const DETAIL_PANEL_WIDTH = 450;

  return (
    <div 
      className="excel-wbs-view"
      onClick={handleBackgroundClick}
      style={{ position: 'relative' }}
    >
      {/* WBS ヘッダー */}
      <div className="wbs-header">
        <div>
          <button 
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateForm(true);
            }}
            disabled={isExportingPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FaPlus />
            タスク追加
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="wbs-info">
            <span>総タスク数: {sortedTasks.length}</span>
          </div>
        </div>
      </div>

      {/* PDF出力ステータス表示 */}
      {isExportingPDF && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#e3f2fd',
          border: '1px solid #bbdefb',
          borderRadius: '4px',
          marginBottom: '1rem',
          color: '#1976d2',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '18px' }}>🔄</span>
          <span>PDFを生成中です。画面の操作はお控えください...</span>
        </div>
      )}

      {/* タスク作成フォーム（必須項目バリデーション追加） */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal">
            <h3>新しいタスクを追加</h3>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label>タスク名 *</label>
                <input
                  type="text"
                  required
                  value={newTask.task_name}
                  onChange={(e) => setNewTask({...newTask, task_name: e.target.value})}
                  placeholder="例: 要件定義書作成"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>予定工数（人日）*</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={newTask.estimated_duration}
                    onChange={(e) => setNewTask({...newTask, estimated_duration: Number(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label>担当者 *</label>
                  <select
                    required
                    value={newTask.assignee_id}
                    onChange={(e) => setNewTask({...newTask, assignee_id: e.target.value})}
                  >
                    <option value="">選択してください</option>
                    {projectMembers.map(member => (
                      <option key={member.employee_id} value={member.employee_id}>
                        {member.employee_name} (稼働率: {(member.allocation_ratio * 100).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                  {projectMembers.length === 0 && (
                    <small style={{ color: '#ff9800', fontSize: '0.8rem' }}>
                      プロジェクトにメンバーが登録されていません。メンバー管理タブから追加してください。
                    </small>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>カテゴリ</label>
                <input
                  type="text"
                  list="category-suggestions"
                  value={newTask.task_category}
                  onChange={(e) => setNewTask({...newTask, task_category: e.target.value})}
                  placeholder="例: 要件定義、開発、テスト"
                />
                <datalist id="category-suggestions">
                  {existingCategories.map(category => (
                    <option key={category} value={category} />
                  ))}
                  <option value="要件定義" />
                  <option value="設計" />
                  <option value="開発" />
                  <option value="テスト" />
                  <option value="リリース" />
                </datalist>
              </div>
              <div className="form-group">
                <label>説明</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  placeholder="タスクの詳細説明"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newTask.milestone_flag}
                    onChange={(e) => setNewTask({...newTask, milestone_flag: e.target.checked})}
                  />
                  マイルストーンとして設定
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  作成
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

      <div style={{ display: 'flex', position: 'relative' }}>
        {/* ガントチャートテーブル */}
        <div 
          ref={ganttContainerRef}
          style={{
            height: 'calc(100vh - 280px)',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden',
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            width: selectedTask ? `calc(100% - ${DETAIL_PANEL_WIDTH}px)` : '100%',
            transition: 'width 0.3s ease'
          }}
          data-pdf-export="gantt-chart"
        >
          {/* ヘッダー行 */}
          <div style={{
            display: 'flex',
            height: '50px',
            backgroundColor: '#f8f9fa',
            borderBottom: '2px solid #e0e0e0',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            {/* 左側固定ヘッダー */}
            <div style={{
              width: `${LEFT_COLUMNS_WIDTH}px`,
              display: 'flex',
              borderRight: '2px solid #e0e0e0',
              backgroundColor: '#f8f9fa',
              position: 'sticky',
              left: 0,
              zIndex: 101
            }}>
              <div style={{ 
                width: '120px',
                padding: '0.5rem', 
                borderRight: '1px solid #e0e0e0', 
                fontSize: '0.8rem', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                カテゴリ
              </div>
              <div style={{ 
                width: '170px',
                padding: '0.5rem', 
                borderRight: '1px solid #e0e0e0', 
                fontSize: '0.8rem', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center'
              }}>
                タスク名
              </div>
              <div style={{ 
                width: '90px', 
                padding: '0.5rem', 
                borderRight: '1px solid #e0e0e0', 
                fontSize: '0.8rem', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                担当者
              </div>
              <div style={{ 
                width: '80px', 
                padding: '0.5rem', 
                borderRight: '1px solid #e0e0e0', 
                fontSize: '0.8rem', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                進捗
              </div>
              <div style={{ 
                width: '110px', 
                padding: '0.5rem', 
                fontSize: '0.8rem', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                ステータス
              </div>
            </div>

            {/* 右側日付ヘッダー */}
            <div 
              ref={rightHeaderRef}
              onScroll={handleHeaderScroll}
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                minWidth: 0
              }}
            >
              {dateRange.map((date, index) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const monthStart = isMonthStart(date, index);
                const outsideProject = isOutsideProjectPeriod(date);
                
                return (
                  <div 
                    key={index} 
                    style={{ 
                      minWidth: `${DATE_CELL_WIDTH}px`,
                      width: `${DATE_CELL_WIDTH}px`,
                      padding: '0.25rem',
                      borderRight: index % 7 === 6 ? '2px solid #1976d2' : '1px solid #e0e0e0',
                      textAlign: 'center',
                      fontSize: '0.7rem',
                      backgroundColor: outsideProject 
                        ? '#f5f5f5'
                        : isWeekend ? '#ffebee' : '#f8f9fa',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexShrink: 0,
                      opacity: outsideProject ? 0.6 : 1
                    }}
                  >
                    <div style={{ fontWeight: 600, color: outsideProject ? '#999' : '#333' }}>
                      {date.getDate()}
                    </div>
                    <div style={{ color: outsideProject ? '#999' : '#666', fontSize: '0.6rem' }}>
                      {getDayOfWeek(date)}
                    </div>
                    {monthStart && (
                      <div style={{ fontSize: '0.55rem', color: outsideProject ? '#999' : '#1976d2', fontWeight: 600 }}>
                        {date.getMonth() + 1}月
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ボディ部分 */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* 左側固定列 */}
            <div 
              ref={leftBodyRef}
              onScroll={handleLeftScroll}
              style={{
                width: `${LEFT_COLUMNS_WIDTH}px`,
                overflowY: 'auto',
                overflowX: 'hidden',
                borderRight: '2px solid #e0e0e0',
                backgroundColor: 'white',
                position: 'sticky',
                left: 0,
                zIndex: 10
              }}
            >
              {sortedTasks.map((task, taskIndex) => {
                const progress = task.checklist_progress;
                const isSelected = selectedTask?.task_id === task.task_id;
                const taskCategory = getTaskCategory(task);
                
                return (
                  <div 
                    key={task.task_id} 
                    style={{ 
                      display: 'flex',
                      height: `${ROW_HEIGHT}px`,
                      minHeight: `${ROW_HEIGHT}px`,
                      borderBottom: '1px solid #e0e0e0',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#e3f2fd' : 'white'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTaskSelect(task);
                    }}
                  >
                    {/* カテゴリ列 */}
                    <div style={{ 
                      width: '120px',
                      borderRight: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem'
                    }}>
                      {taskCategory && (
                        <div style={{
                          backgroundColor: getCategoryColor(taskCategory),
                          color: 'white',
                          padding: '0.2rem 0.4rem',
                          fontSize: '0.7rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          {taskCategory}
                        </div>
                      )}
                    </div>
                    
                    {/* タスク名列 */}
                    <div style={{ 
                      width: '170px',
                      padding: '0.5rem', 
                      borderRight: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.8rem'
                    }}>
                      <span style={{ 
                        color: '#1976d2', 
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {task.task_name}
                        {task.milestone_flag && (
                          <span style={{ marginLeft: '0.25rem' }}>🏁</span>
                        )}
                      </span>
                    </div>
                    
                    {/* 担当者列 */}
                    <div style={{ 
                      width: '90px', 
                      padding: '0.5rem', 
                      borderRight: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      color: '#666'
                    }}>
                      {task.assignee ? (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            maxWidth: '80px'
                          }}>
                            {task.assignee.employee_name}
                          </div>
                        </div>
                      ) : '未割当'}
                    </div>
                    
                    {/* 進捗列 */}
                    <div style={{ 
                      width: '80px', 
                      padding: '0.5rem', 
                      borderRight: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: '0.2rem'
                    }}>
                      <div style={{ 
                        width: '50px', 
                        height: '4px', 
                        backgroundColor: '#e0e0e0', 
                        borderRadius: '2px', 
                        overflow: 'hidden' 
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${progress * 100}%`,
                          backgroundColor: getProgressColor(progress, task.status_code || 'NOT_STARTED'),
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#666' }}>
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                    
                    {/* ステータス列 */}
                    <div style={{ 
                      width: '110px', 
                      padding: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <select
                        value={task.status_code || 'NOT_STARTED'}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(task.task_id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isExportingPDF}
                        style={{
                          padding: '0.5rem',
                          fontSize: '0.7rem',
                          border: '1px solid #ddd',
                          borderRadius: '3px',
                          backgroundColor: 'white',
                          cursor: isExportingPDF ? 'not-allowed' : 'pointer',
                          width: '90px'
                        }}
                      >
                        <option value="NOT_STARTED">未着手</option>
                        <option value="IN_PROGRESS">進行中</option>
                        <option value="COMPLETED">完了</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* 右側ガントチャート部分 */}
            <div 
              ref={rightBodyRef}
              onScroll={handleRightScroll}
              style={{
                flex: 1,
                overflow: 'auto',
                position: 'relative'
              }}
            >
              <div style={{
                width: `${dateRange.length * DATE_CELL_WIDTH}px`,
                minHeight: `${sortedTasks.length * ROW_HEIGHT}px`,
                position: 'relative'
              }}>
                {sortedTasks.map((task, taskIndex) => {
                  const isSelected = selectedTask?.task_id === task.task_id;
                  const position = getTaskPosition(task);
                  const taskCategory = getTaskCategory(task);
                  
                  return (
                    <div 
                      key={task.task_id} 
                      style={{ 
                        position: 'absolute',
                        top: `${taskIndex * ROW_HEIGHT}px`,
                        left: 0,
                        right: 0,
                        height: `${ROW_HEIGHT}px`,
                        borderBottom: '1px solid #e0e0e0',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(227, 242, 253, 0.3)' : 'transparent'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskSelect(task);
                      }}
                    >
                      {/* タイムライン背景とガントバー */}
                      {dateRange.map((date, index) => {
                        const isToday = date.toDateString() === today;
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const outsideProject = isOutsideProjectPeriod(date);
                        
                        // タスク期間内かどうかを判定
                        let isTaskCell = false;
                        if (position) {
                          const cellLeft = index * DATE_CELL_WIDTH;
                          const cellRight = (index + 1) * DATE_CELL_WIDTH;
                          const taskLeft = position.left;
                          const taskRight = position.left + position.width;
                          isTaskCell = cellLeft < taskRight && cellRight > taskLeft;
                        }
                        
                        return (
                          <div 
                            key={index} 
                            style={{ 
                              position: 'absolute',
                              left: `${index * DATE_CELL_WIDTH}px`,
                              width: `${DATE_CELL_WIDTH}px`,
                              height: '100%',
                              borderRight: index % 7 === 6 ? '2px solid #e0e0e0' : '1px solid #f5f5f5',
                              backgroundColor: isTaskCell ? (
                                taskCategory ? getCategoryColor(taskCategory) :
                                task.milestone_flag 
                                  ? 'rgba(255, 87, 34, 0.8)'
                                  : task.status_code === 'COMPLETED' ? 'rgba(76, 175, 80, 0.8)'
                                  : task.status_code === 'IN_PROGRESS' ? 'rgba(255, 152, 0, 0.8)'
                                  : 'rgba(158, 158, 158, 0.8)'
                              ) : (
                                isToday ? 'rgba(25, 118, 210, 0.1)' : 
                                outsideProject ? 'rgba(128, 128, 128, 0.2)' :
                                isWeekend ? 'rgba(255, 235, 238, 0.2)' : 'transparent'
                              ),
                              opacity: outsideProject && !isTaskCell ? 0.3 : 1,
                              cursor: isTaskCell ? 'pointer' : 'default',
                              zIndex: isTaskCell ? 5 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              // PDF出力時の色保持
                              WebkitPrintColorAdjust: 'exact',
                              colorAdjust: 'exact',
                              printColorAdjust: 'exact'
                            }}
                            onClick={isTaskCell ? (e) => {
                              e.stopPropagation();
                              handleTaskSelect(task);
                            } : undefined}
                          >
                            {/* 進捗表示 */}
                            {isTaskCell && task.checklist_progress > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${task.checklist_progress * 100}%`,
                                background: 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4) 3px, rgba(255, 255, 255, 0.2) 3px, rgba(255, 255, 255, 0.2) 6px)',
                                borderRadius: '0px',
                                transition: 'width 0.3s ease',
                                WebkitPrintColorAdjust: 'exact',
                                colorAdjust: 'exact',
                                printColorAdjust: 'exact'
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* タスク詳細パネル（右側）（必須項目バリデーション追加） */}
        {selectedTask && (
          <div 
            className="task-detail-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: `${DETAIL_PANEL_WIDTH}px`,
              backgroundColor: 'white',
              borderLeft: '1px solid #e0e0e0',
              boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
              overflowY: 'auto',
              transform: selectedTask ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.3s ease'
            }}
          >
            <div className="panel-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              borderBottom: '1px solid #e0e0e0',
              backgroundColor: '#f8f9fa',
              position: 'sticky',
              top: 0,
              zIndex: 1001
            }}>
              <h4 style={{ margin: 0, color: '#1976d2' }}>タスク詳細</h4>
              <button 
                className="btn-close"
                onClick={() => setSelectedTask(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#666',
                  width: '30px',
                  height: '30px',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="panel-content" style={{ padding: '1rem' }}>
              {/* タスク詳細表示/編集（必須項目対応） */}
              {isEditing ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>タスク名 *</label>
                    <input
                      type="text"
                      required
                      value={editData.task_name}
                      onChange={(e) => setEditData({...editData, task_name: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>予定工数（人日）*</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={editData.estimated_duration}
                      onChange={(e) => setEditData({...editData, estimated_duration: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label>担当者 *</label>
                    <select
                      required
                      value={editData.assignee_id}
                      onChange={(e) => setEditData({...editData, assignee_id: e.target.value})}
                    >
                      <option value="">選択してください</option>
                      {projectMembers.map(member => (
                        <option key={member.employee_id} value={member.employee_id}>
                          {member.employee_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>カテゴリ</label>
                    <input
                      type="text"
                      list="edit-category-suggestions"
                      value={editData.category}
                      onChange={(e) => setEditData({...editData, category: e.target.value})}
                      placeholder="例: 要件定義、開発、テスト"
                    />
                    <datalist id="edit-category-suggestions">
                      {existingCategories.map(category => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label>説明</label>
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData({...editData, description: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>ステータス</label>
                    <select
                      value={editData.status_code}
                      onChange={(e) => setEditData({...editData, status_code: e.target.value})}
                    >
                      <option value="NOT_STARTED">未着手</option>
                      <option value="IN_PROGRESS">進行中</option>
                      <option value="COMPLETED">完了</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-primary" onClick={handleSaveTask}>
                      保存
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setIsEditing(false)}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="task-details">
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <h5 style={{ margin: 0 }}>{selectedTask.task_name}</h5>
                      {selectedTask.milestone_flag && (
                        <span style={{ fontSize: '1.2rem' }}>🏁</span>
                      )}
                    </div>
                    {getTaskCategory(selectedTask) && (
                      <div style={{
                        backgroundColor: getCategoryColor(getTaskCategory(selectedTask)!),
                        color: 'white',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        display: 'inline-block',
                        marginBottom: '0.5rem'
                      }}>
                        {getTaskCategory(selectedTask)}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}><strong>説明:</strong></div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      {getDescriptionWithoutCategory(selectedTask.description || '') || '説明なし'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>予定工数</div>
                      <div>{selectedTask.estimated_duration || 0}人日</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>進捗</div>
                      <div>{Math.round(selectedTask.checklist_progress * 100)}%</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>担当者</div>
                    <div>{selectedTask.assignee?.employee_name || '未割当'}</div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>期間</div>
                    <div>{selectedTask.start_date || '未定'} ～ {selectedTask.end_date || '未定'}</div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>ステータス</div>
                    <span className={`status ${selectedTask.status_code?.toLowerCase()}`}>
                      {selectedTask.status_code === 'NOT_STARTED' ? '未着手' :
                       selectedTask.status_code === 'IN_PROGRESS' ? '進行中' :
                       selectedTask.status_code === 'COMPLETED' ? '完了' : selectedTask.status_code}
                    </span>
                  </div>
                  
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setIsEditing(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <FaEdit />
                    編集
                  </button>
                </div>
              )}

              {/* チェックリスト管理 */}
              <div style={{ 
                marginTop: '2rem', 
                paddingTop: '1rem', 
                borderTop: '1px solid #e0e0e0' 
              }}>
                <h5 style={{ 
                  margin: '0 0 1rem 0', 
                  color: '#1976d2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <FaTasks />
                  チェックリスト
                </h5>
                
                <form onSubmit={handleAddChecklistItem} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="新しいアイテム"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      style={{ 
                        padding: '0.5rem 0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.8rem'
                      }}
                    >
                      <FaPlus />
                    </button>
                  </div>
                </form>

                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {checklistItems.map((item) => (
                    <div 
                      key={item.checklist_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        border: '1px solid #f0f0f0'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.is_done}
                        onChange={(e) => handleChecklistToggle(item.checklist_id, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      
                      {editingChecklist === item.checklist_id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input
                            type="text"
                            value={editingChecklistText}
                            onChange={(e) => setEditingChecklistText(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '0.25rem',
                              border: '1px solid #ddd',
                              borderRadius: '3px',
                              fontSize: '0.9rem'
                            }}
                          />
                          <button
                            onClick={() => handleSaveEditChecklist(item.checklist_id)}
                            style={{
                              padding: '0.5rem 0.7rem',
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            <FaSave />
                          </button>
                          <button
                            onClick={() => {
                              setEditingChecklist(null);
                              setEditingChecklistText('');
                            }}
                            style={{
                              padding: '0.5rem 0.7rem',
                              backgroundColor: '#757575',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                          <span 
                            style={{
                              flex: 1,
                              textDecoration: item.is_done ? 'line-through' : 'none',
                              color: item.is_done ? '#999' : '#333',
                              fontSize: '0.9rem'
                            }}
                          >
                            {item.item_name}
                          </span>
                          <button
                            onClick={() => handleStartEditChecklist(item)}
                            style={{
                              padding: '0.5rem 0.7rem',
                              backgroundColor: '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            <FaEdit />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {checklistItems.length === 0 && (
                  <p style={{ 
                    color: '#999', 
                    fontStyle: 'italic', 
                    textAlign: 'center',
                    padding: '1rem',
                    fontSize: '0.9rem'
                  }}>
                    チェックリストアイテムがありません
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {sortedTasks.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          color: '#666',
          backgroundColor: 'white',
          borderRadius: '8px',
          marginTop: '1rem'
        }}>
          タスクがありません。タスクを追加してください。
        </div>
      )}
    </div>
  );
};

export default WBSView;