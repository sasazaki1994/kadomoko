import { taskDefById } from '../game/dailyTasks';
import { usePetStore } from '../store/usePetStore';

export default function DailyTaskList() {
  const tasks = usePetStore((s) => s.pet.dailyTasks.tasks);

  return (
    <div className="daily-tasks">
      <div className="daily-tasks-title">今日の日課</div>
      <ul>
        {tasks.map((task) => {
          const def = taskDefById(task.id);
          return (
            <li key={task.id} className={task.completed ? 'done' : ''}>
              <span className="task-check">{task.completed ? '✓' : '・'}</span>
              {def.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
