import { dailyTaskProgressText, taskDefById } from '../game/dailyTasks';
import { usePetStore } from '../store/usePetStore';

export default function DailyTaskList() {
  const dailyTasks = usePetStore((s) => s.pet.dailyTasks);

  return (
    <div className="daily-tasks">
      <div className="daily-tasks-title">今日の日課</div>
      <ul>
        {dailyTasks.tasks.map((task) => {
          const def = taskDefById(task.id);
          const progress = task.completed ? undefined : dailyTaskProgressText(dailyTasks, task.id);
          return (
            <li key={task.id} className={task.completed ? 'done' : ''}>
              <span className="task-check">{task.completed ? '✓' : '・'}</span>
              <span className="task-label">{def.label}</span>
              {progress && <span className="task-progress">{progress}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
