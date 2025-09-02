import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  addEdge,
  Handle,
  Position,
  MarkerType,
  ConnectionMode, 
  ReactFlowProvider,
} from 'react-flow-renderer';
import { FaPlus, FaTimes, FaEdit, FaSave, FaTasks } from 'react-icons/fa';
import { WBSTask, TaskDependency, Employee, TaskChecklist, ProjectMember } from '../types/index';
import { taskAPI, checklistAPI } from '../utils/api';

interface Props {
  tasks: WBSTask[];
  employees: Employee[];
  members: ProjectMember[];
  onUpdateTask: () => void;
  onCreateTask: (task: any) => void;
  onCreateDependency: (dependency: TaskDependency) => Promise<void>;
  onScheduleChange: () => void;
}

// カスタムタスクノードコンポーネント
const TaskNode: React.FC<{ data: any }> = ({ data }) => {
  const { task } = data;
  
  const statusColors = {
    'NOT_STARTED': '#9E9E9E',
    'IN_PROGRESS': '#FF9800',
    'COMPLETED': '#4CAF50'
  } as const;
  
  type StatusKey = keyof typeof statusColors;
  
  const statusCode = task.status_code as StatusKey;
  const statusColor = statusColors[statusCode] || statusColors['NOT_STARTED'];

  // タスクからカテゴリを抽出
  const getTaskCategory = (task: WBSTask) => {
    if (task.description && task.description.startsWith('[') && task.description.includes(']')) {
      const match = task.description.match(/^\[([^\]]+)\]/);
      return match ? match[1] : null;
    }
    return null;
  };

  // カテゴリ色を生成
  const getCategoryColor = (category: string) => {
    const colors = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#d32f2f', '#0097a7', '#5d4037'];
    const hash = category.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const taskCategory = getTaskCategory(task);

  return (
    <div 
      className="task-node"
      style={{ 
        borderColor: statusColor,
        position: 'relative',
        width: '220px',
        height: '160px', // 高さを少し増加
        padding: '8px'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          background: '#4CAF50',
          width: 16,
          height: 16,
          border: '2px solid white',
          borderRadius: '50%',
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10
        }}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          background: '#2196F3',
          width: 16,
          height: 16,
          border: '2px solid white',
          borderRadius: '50%',
          right: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10
        }}
      />
      
      <div className="task-node-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <strong>{task.task_name}</strong>
          {task.milestone_flag && <span className="milestone">🏁</span>}
        </div>
        {taskCategory && (
          <div style={{
            backgroundColor: getCategoryColor(taskCategory),
            color: 'white',
            padding: '0.1rem 0.3rem',
            borderRadius: '3px',
            fontSize: '0.65rem',
            display: 'inline-block',
            marginBottom: '0.25rem'
          }}>
            {taskCategory}
          </div>
        )}
      </div>
      <div className="task-node-body" style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
        <div>工数: {task.estimated_duration}人日</div>
        <div>担当: {task.assignee?.employee_name || '未割当'}</div>
        <div>期間: {task.start_date || '未定'} ～ {task.end_date || '未定'}</div>
        <div>進捗: {Math.round(task.checklist_progress * 100)}%</div>
      </div>
    </div>
  );
};

const nodeTypes = {
  taskNode: TaskNode,
};

const PERTChart: React.FC<Props> = ({ 
  tasks, 
  employees, 
  members,
  onUpdateTask, 
  onCreateTask, 
  onCreateDependency,
  onScheduleChange 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTask, setSelectedTask] = useState<WBSTask | null>(null);
  const [dependencyType, setDependencyType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  
  // タスク作成フォーム関連の状態
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    task_name: '',
    description: '',
    estimated_duration: 1,
    task_category: '', // カテゴリ項目を追加
    assignee_id: '',
    milestone_flag: false
  });

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

  // プロジェクトメンバーのみをフィルタ
  const projectMembers = useMemo(() => {
    return members.map(member => ({
      ...member.employee!,
      allocation_ratio: member.allocation_ratio || 1.0
    }));
  }, [members]);

  // タスクからノード・エッジ生成
  useEffect(() => {
    const newNodes: Node[] = tasks.map((task, index) => ({
      id: task.task_id.toString(),
      type: 'taskNode',
      position: { 
        x: task.x_position || (index % 4) * 300 + 100,
        y: task.y_position || Math.floor(index / 4) * 220 + 100 // Y間隔を増加
      },
      data: { task, label: task.task_name },
      draggable: true,
      selectable: true,
    }));

    const newEdges: Edge[] = [];
    tasks.forEach(task => {
      task.dependencies.forEach((dep) => {
        const dependencyTypeLabels = {
          'FS': 'FS',
          'SS': 'SS',
          'FF': 'FF',
          'SF': 'SF'
        };
        
        newEdges.push({
          id: `${dep.depends_on_id}-${dep.task_id}`,
          source: dep.depends_on_id.toString(),
          target: dep.task_id.toString(),
          label: dependencyTypeLabels[dep.dependency_type as keyof typeof dependencyTypeLabels] || dep.dependency_type,
          type: 'straight', // 修正：矢印をまっすぐに
          animated: true,
          style: { 
            strokeWidth: 3,
            stroke: dep.dependency_type === 'FS' ? '#1976d2' : '#ff9800'
          },
          markerEnd: {
            type: MarkerType.Arrow,
            width: 20,
            height: 20,
            color: dep.dependency_type === 'FS' ? '#1976d2' : '#ff9800',
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [tasks, setNodes, setEdges]);

  // selectedTaskを最新のタスクデータで更新
  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.task_id === selectedTask.task_id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    }
  }, [tasks, selectedTask]);

  // 依存関係作成（エッジ接続時）
  const onConnect = useCallback(
    async (params: Connection) => {
      console.log('Connection attempt:', params);

      if (!params.source || !params.target) {
        console.log('Invalid connection: missing source or target');
        return;
      }

      if (params.source === params.target) {
        alert('同じタスク同士は依存関係を作成できません。');
        return;
      }

      const existingDependency = tasks
        .find(t => t.task_id.toString() === params.target)
        ?.dependencies.find(d => d.depends_on_id.toString() === params.source);

      if (existingDependency) {
        alert('この依存関係は既に存在します。');
        return;
      }

      const hasCycle = (sourceId: string, targetId: string): boolean => {
        const visited = new Set<string>();
        const stack = [targetId];
        
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (visited.has(current)) continue;
          visited.add(current);
          
          if (current === sourceId) return true;
          
          const currentTask = tasks.find(t => t.task_id.toString() === current);
          if (currentTask) {
            currentTask.dependencies.forEach(dep => {
              stack.push(dep.depends_on_id.toString());
            });
          }
        }
        return false;
      };

      if (hasCycle(params.source, params.target)) {
        alert('循環依存が発生するため、この依存関係は作成できません。');
        return;
      }

      try {
        const dependencyData = {
          task_id: Number(params.target),
          depends_on_id: Number(params.source),
          dependency_type: dependencyType
        };
        
        console.log('Creating dependency:', dependencyData);

        await onCreateDependency(dependencyData);
        
        onScheduleChange();
        
        await onUpdateTask();
        
        const sourceTask = tasks.find(t => t.task_id.toString() === params.source);
        const targetTask = tasks.find(t => t.task_id.toString() === params.target);
        console.log(`依存関係を作成しました: ${sourceTask?.task_name} → ${targetTask?.task_name} (${dependencyType})`);
        
      } catch (error) {
        console.error('依存関係作成エラー:', error);
        alert('依存関係の作成に失敗しました。詳細はコンソールをご確認ください。');
      }
    },
    [onCreateDependency, onUpdateTask, onScheduleChange, dependencyType, tasks]
  );

  // エッジ削除処理
  const onEdgeClick = useCallback(
    async (event: any, edge: Edge) => {
      event.stopPropagation();
      
      const [sourceId, targetId] = edge.id.split('-');
      const sourceTask = tasks.find(t => t.task_id.toString() === sourceId);
      const targetTask = tasks.find(t => t.task_id.toString() === targetId);
      
      if (window.confirm(`依存関係を削除しますか？\n${sourceTask?.task_name} → ${targetTask?.task_name}`)) {
        try {
          await taskAPI.deleteDependency(Number(targetId), Number(sourceId));
          
          onScheduleChange();
          
          await onUpdateTask();
        } catch (error) {
          console.error('依存関係削除エラー:', error);
          alert('依存関係の削除に失敗しました。');
        }
      }
    },
    [tasks, onUpdateTask, onScheduleChange]
  );

  // ノード位置更新
  const onNodeDragStop = useCallback(
    async (event: any, node: Node) => {
      try {
        await taskAPI.update(Number(node.id), {
          x_position: Math.round(node.position.x),
          y_position: Math.round(node.position.y)
        });
      } catch (error) {
        console.error('ノード位置更新エラー:', error);
      }
    },
    []
  );

  // ノードクリック処理
  const onNodeClick = useCallback((event: any, node: Node) => {
    const task = tasks.find(t => t.task_id.toString() === node.id);
    setSelectedTask(task || null);
  }, [tasks]);

  // タスク作成処理（必須項目バリデーション追加）
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

      // カテゴリを説明の先頭に追加
      const description = newTask.task_category 
        ? `[${newTask.task_category}] ${newTask.description}`
        : newTask.description;

      await onCreateTask({
        ...newTask,
        description,
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

  return (
    <ReactFlowProvider>
      <div className="pert-chart">
        <div className="pert-header">
          <div className="pert-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FaPlus />
              タスク追加
            </button>
          </div>

          <div className="pert-controls">
            <div className="dependency-type-selector">
              <label>依存関係の種類:</label>
              <select 
                value={dependencyType} 
                onChange={(e) => setDependencyType(e.target.value as any)}
              >
                <option value="FS">FS (終了→開始)</option>
                <option value="SS">SS (開始→開始)</option>
                <option value="FF">FF (終了→終了)</option>
                <option value="SF">SF (開始→終了)</option>
              </select>
            </div>
          </div>

          <div className="pert-legend">
            <span className="legend-item">
              <span className="legend-color" style={{backgroundColor: '#9E9E9E'}}></span>
              未着手
            </span>
            <span className="legend-item">
              <span className="legend-color" style={{backgroundColor: '#FF9800'}}></span>
              進行中
            </span>
            <span className="legend-item">
              <span className="legend-color" style={{backgroundColor: '#4CAF50'}}></span>
              完了
            </span>
          </div>
        </div>

        {/* タスク作成フォーム（必須項目バリデーション追加） */}
        {showCreateForm && (
          <div className="modal-overlay">
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
                      onChange={(e) => {
                        setNewTask({...newTask, estimated_duration: Number(e.target.value)});
                      }}
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
                    list="pert-category-suggestions"
                    value={newTask.task_category}
                    onChange={(e) => setNewTask({...newTask, task_category: e.target.value})}
                    placeholder="例: 要件定義、開発、テスト"
                  />
                  <datalist id="pert-category-suggestions">
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

        <div className="pert-container" style={{ height: '600px', position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 0.2,
              maxZoom: 1.5,
              minZoom: 0.1
            }}
            snapToGrid={true}
            snapGrid={[20, 20]}
            deleteKeyCode={null}
            defaultEdgeOptions={{
              type: 'straight', // 修正：矢印をまっすぐに
              animated: false,
              style: { strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.Arrow,
                width: 20,
                height: 20,
              }
            }}
            connectionMode={ConnectionMode.Loose}
            connectOnClick={false}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
          >
            <MiniMap 
              style={{ 
                backgroundColor: '#f8f9fa',
                border: '1px solid #ddd'
              }}
              nodeStrokeColor="#1976d2"
              nodeColor="#ffffff"
              maskColor="#f0f0f0"
            />
            <Controls 
              style={{
                bottom: 20,
                left: 20
              }}
            />
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20}
              size={1}
              color="#e0e0e0"
            />
          </ReactFlow>
        </div>

        {/* タスク詳細サイドパネル */}
        {selectedTask && (
          <TaskDetailPanel 
            task={selectedTask} 
            members={members}
            existingCategories={existingCategories}
            onClose={() => setSelectedTask(null)}
            onUpdate={async () => {
              onScheduleChange();
              await onUpdateTask();
            }}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
};

// タスク詳細サイドパネル（必須項目バリデーション追加）
const TaskDetailPanel: React.FC<{
  task: WBSTask;
  members: ProjectMember[];
  existingCategories: string[];
  onClose: () => void;
  onUpdate: () => void;
}> = ({ task, members, existingCategories, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  
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

  const taskCategory = getTaskCategory(task);
  const descriptionWithoutCategory = getDescriptionWithoutCategory(task.description || '');

  const [editData, setEditData] = useState({
    task_name: task.task_name,
    category: taskCategory || '',
    description: descriptionWithoutCategory,
    estimated_duration: task.estimated_duration || 1,
    status_code: task.status_code || 'NOT_STARTED',
    assignee_id: task.assignee?.employee_id || ''
  });

  const [checklistItems, setChecklistItems] = useState<TaskChecklist[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // カテゴリ色を生成
  const getCategoryColor = (category: string) => {
    const colors = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#d32f2f', '#0097a7', '#5d4037'];
    const hash = category.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // プロジェクトメンバーのみをフィルタ
  const projectMembers = useMemo(() => {
    return members.map(member => ({
      ...member.employee!,
      allocation_ratio: member.allocation_ratio || 1.0
    }));
  }, [members]);

  useEffect(() => {
    if (!isInitialized || task.task_id !== (checklistItems[0]?.task_id)) {
      setChecklistItems([...task.checklist_items].sort((a, b) => a.sort_order - b.sort_order));
      setIsInitialized(true);
    }
    
    const currentCategory = getTaskCategory(task);
    const currentDescWithoutCategory = getDescriptionWithoutCategory(task.description || '');
    
    setEditData({
      task_name: task.task_name,
      category: currentCategory || '',
      description: currentDescWithoutCategory,
      estimated_duration: task.estimated_duration || 1,
      status_code: task.status_code || 'NOT_STARTED',
      assignee_id: task.assignee?.employee_id || ''
    });
  }, [task.task_id, task.checklist_items, task.task_name, task.description, task.estimated_duration, task.status_code, task.assignee, isInitialized]);

  const handleSave = async () => {
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

      console.log('Saving task data:', editData);
      
      // カテゴリを説明の先頭に追加
      const finalDescription = editData.category.trim() 
        ? `[${editData.category.trim()}] ${editData.description}`
        : editData.description;
      
      const updatePayload = {
        task_name: editData.task_name,
        description: finalDescription,
        estimated_duration: editData.estimated_duration,
        status_code: editData.status_code,
        assignee_id: editData.assignee_id ? Number(editData.assignee_id) : undefined
      };
      
      console.log('Update payload:', updatePayload);
      
      await taskAPI.update(task.task_id, updatePayload);
      setIsEditing(false);
      
      await onUpdate();
      
      console.log('Task updated successfully');
    } catch (error) {
      console.error('タスク更新エラー詳細:', error);
      if (error instanceof Error) {
        console.error('エラーメッセージ:', error.message);
      }
      alert(`タスクの更新に失敗しました。詳細: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    
    try {
      const newItem = await checklistAPI.create({
        task_id: task.task_id,
        item_name: newChecklistItem,
        is_done: false,
        sort_order: checklistItems.length
      });
      
      setChecklistItems(prev => [...prev, newItem]);
      setNewChecklistItem('');
      
      await onUpdate();
    } catch (error) {
      console.error('チェックリスト作成エラー:', error);
      alert('チェックリストアイテムの追加に失敗しました。');
    }
  };

  const handleChecklistToggle = async (checklistId: number, isDone: boolean) => {
    try {
      console.log(`Updating checklist ${checklistId} to ${isDone}`);
      
      setChecklistItems(prev => 
        prev.map(item => 
          item.checklist_id === checklistId 
            ? { ...item, is_done: isDone }
            : item
        )
      );
      
      await checklistAPI.update(checklistId, { is_done: isDone });
      await onUpdate();
      
      console.log(`Checklist ${checklistId} updated successfully`);
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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newItems = [...checklistItems];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    setChecklistItems(newItems);

    try {
      const updatePromises = newItems.map((item, index) => 
        checklistAPI.update(item.checklist_id, { sort_order: index })
      );
      
      await Promise.all(updatePromises);
      await onUpdate();
    } catch (error) {
      console.error('チェックリスト順序更新エラー:', error);
      setChecklistItems([...task.checklist_items].sort((a, b) => a.sort_order - b.sort_order));
      alert('順序の変更に失敗しました。');
    }

    setDraggedIndex(null);
  };

  return (
    <div className="task-detail-panel">
      <div className="panel-header">
        <h4>タスク詳細</h4>
        <button className="btn-close" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="panel-content">
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
                    {member.employee_name} (稼働率: {(member.allocation_ratio * 100).toFixed(0)}%)
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
                value={editData.description}
                onChange={(e) => setEditData({...editData, description: e.target.value})}
                placeholder="タスクの詳細説明"
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
              <button className="btn btn-primary" onClick={handleSave}>
                保存
              </button>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="task-details">
            <div className="detail-item">
              <label>タスク名:</label>
              <span>{task.task_name}</span>
            </div>
            <div className="detail-item">
              <label>カテゴリ:</label>
              <span>
                {taskCategory ? (
                  <div style={{
                    backgroundColor: getCategoryColor(taskCategory),
                    color: 'white',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    display: 'inline-block'
                  }}>
                    {taskCategory}
                  </div>
                ) : '-'}
              </span>
            </div>
            <div className="detail-item">
              <label>説明:</label>
              <span>{descriptionWithoutCategory || '-'}</span>
            </div>
            <div className="detail-item">
              <label>予定工数:</label>
              <span>{task.estimated_duration}人日</span>
            </div>
            <div className="detail-item">
              <label>担当者:</label>
              <span>
                {task.assignee ? (
                  <>
                    {task.assignee.employee_name}
                    <br />
                    <small style={{ color: '#999' }}>
                      稼働率: {((members.find(m => m.employee_id === task.assignee?.employee_id)?.allocation_ratio || 1.0) * 100).toFixed(0)}%
                    </small>
                  </>
                ) : '未割当'}
              </span>
            </div>
            <div className="detail-item">
              <label>期間:</label>
              <span>{task.start_date || '未定'} ～ {task.end_date || '未定'}</span>
            </div>
            <div className="detail-item">
              <label>ステータス:</label>
              <span className={`status ${task.status_code?.toLowerCase()}`}>
                {task.status_code === 'NOT_STARTED' ? '未着手' :
                 task.status_code === 'IN_PROGRESS' ? '進行中' :
                 task.status_code === 'COMPLETED' ? '完了' : task.status_code}
              </span>
            </div>
            <div className="detail-item">
              <label>チェックリスト進捗:</label>
              <span>{Math.round(task.checklist_progress * 100)}%</span>
            </div>
            
            <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
              <FaEdit style={{ marginRight: '0.5rem' }} />
              編集
            </button>
          </div>
        )}

        <div className="checklist-section" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0' }}>
          <h5>
            <FaTasks style={{ marginRight: '0.5rem' }} />
            チェックリスト管理
          </h5>
          
          <form onSubmit={handleAddChecklistItem} style={{ marginBottom: '1rem' }}>
            <div className="add-checklist-form">
              <input
                type="text"
                placeholder="新しいチェックリストアイテム"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
              />
              <button type="submit" className="btn btn-small btn-primary">
                <FaPlus style={{ marginRight: '0.25rem' }} />
                追加
              </button>
            </div>
          </form>

          <div className="draggable-checklist">
            {checklistItems.map((item, index) => (
              <DraggableChecklistItem
                key={item.checklist_id}
                item={item}
                index={index}
                onToggle={handleChecklistToggle}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>

          {checklistItems.length === 0 && (
            <p style={{ color: '#666', fontStyle: 'italic', marginTop: '0.5rem' }}>
              チェックリストアイテムがありません
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ドラッグ&ドロップ対応チェックリストコンポーネント
const DraggableChecklistItem: React.FC<{
  item: TaskChecklist;
  index: number;
  onToggle: (id: number, isDone: boolean) => Promise<void>;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dropIndex: number) => void;
}> = ({ item, index, onToggle, onDragStart, onDragOver, onDrop }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      await onToggle(item.checklist_id, e.target.checked);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart(e, index);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`checklist-item draggable-item ${isDragging ? 'being-dragged' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      style={{
        padding: '0.75rem',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        marginBottom: '0.5rem',
        backgroundColor: '#fff',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isUpdating ? 0.6 : isDragging ? 0.8 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
        transition: isDragging ? 'none' : 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}
    >
      <div 
        style={{ 
          fontSize: '1.2rem', 
          color: '#999', 
          cursor: 'grab',
          padding: '0.25rem',
          borderRadius: '3px',
          background: isDragging ? '#e0e0e0' : 'transparent',
          minWidth: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        ⋮⋮
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
        <input
          type="checkbox"
          checked={item.is_done}
          onChange={handleToggle}
          disabled={isUpdating}
          style={{ 
            cursor: 'pointer',
            transform: 'scale(1.1)',
            accentColor: '#1976d2'
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <label 
          style={{ 
            cursor: 'pointer', 
            flex: 1,
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}
          onClick={(e) => {
            e.preventDefault();
            if (!isUpdating && !isDragging) {
              const checkbox = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }}
        >
          <span className={item.is_done ? 'completed' : ''}>
            {item.item_name}
          </span>
        </label>
      </div>
    </div>
  );
};

export default PERTChart;