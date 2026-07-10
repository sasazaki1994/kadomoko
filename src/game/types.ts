export type PetVitals = {
  hunger: number;
  mood: number;
  sleepiness: number;
  affection: number;
};

export type PetMachineState =
  | 'idle'
  | 'happy'
  | 'hungry'
  | 'sleepy'
  | 'sleeping'
  | 'sulking'
  | 'playing'
  | 'curious'
  | 'resting'
  | 'reaction'
  | 'levelUp';

export type Personality =
  | 'normal'
  | 'sweet'
  | 'energetic'
  | 'relaxed'
  | 'moody'
  | 'sulky'
  | 'calm';

export type CareActionId = 'feed' | 'touch' | 'play' | 'rest';

export type DayPeriod =
  | 'morning'
  | 'daytime'
  | 'evening'
  | 'night'
  | 'lateNight';

/**
 * Long-running action persisted in save data ('none' when free).
 * Short animations such as resting are PetMachineState-only temporary states.
 */
export type CurrentAction = 'none' | 'sleeping';

export type CareStats = {
  feedCount: number;
  touchCount: number;
  playCount: number;
  restCount: number;
  neglectTimeMs: number;
  activeTogetherTimeMs: number;
  lowHungerTimeMs: number;
};

export type DailyTaskId =
  | 'feed_once'
  | 'touch_once'
  | 'play_once'
  | 'rest_once'
  | 'together_30min'
  | 'good_mood_15min';

export type DailyTaskDef = {
  id: DailyTaskId;
  label: string;
  rewardExp: number;
  rewardAffection: number;
};

export type DailyTaskState = {
  id: DailyTaskId;
  completed: boolean;
};

export type DailyTasksState = {
  /** Local date string YYYY-MM-DD the tasks were rolled for. */
  date: string;
  tasks: DailyTaskState[];
  /** Online time spent together today (ms), for together_30min. */
  togetherMsToday: number;
  /** Consecutive time with good mood (ms), for good_mood_15min. */
  goodMoodStreakMs: number;
};

export type PersonalityHistoryEntry = {
  date: string;
  tendency: Personality;
};

export type DailyJournalEntry = {
  date: string;
  careCounts: {
    feed: number;
    touch: number;
    play: number;
    rest: number;
  };
  finalVitals: PetVitals;
  personality: Personality;
  completedTaskCount: number;
  note: string;
};

export type PetState = {
  vitals: PetVitals;
  exp: number;
  level: number;
  currentAction: CurrentAction;
  careStats: CareStats;
  personality: Personality;
  personalityHistory: PersonalityHistoryEntry[];
  unlockedReactionIds: string[];
  unlockedIdleMotionIds: string[];
  unlockedSpeechPackIds: string[];
  unlockedPropIds: string[];
  dailyTasks: DailyTasksState;
  /** epoch ms of the last time progression run. */
  lastUpdatedAt: number;
  /** epoch ms of the last care action. */
  lastCareAt: number;
  /** epoch ms per action, for cooldown checks. */
  lastActionAt: Partial<Record<CareActionId, number>>;
  /** Carry-over ms toward the next 10-minute decay chunk. */
  pendingDecayMs: number;
  /** Accumulated ms with mood >= 80, toward the 30-minute affection bonus. */
  highMoodMs: number;
  /** epoch ms the last random event fired. */
  lastRandomEventAt: number;
  journalEntries: DailyJournalEntry[];
};

export type SaveSettings = {
  alwaysOnTop: boolean;
  volume: number;
};

export type SaveData = {
  version: number;
  pet: PetState;
  settings: SaveSettings;
  lastLaunchedAt: number;
};

export type ActionBlockReason = 'cooldown' | 'tooSleepy' | 'tooHungry';

export type CareActionResult = {
  pet: PetState;
  ok: boolean;
  blockReason?: ActionBlockReason;
  leveledUp: boolean;
  newLevel?: number;
  completedTaskIds: DailyTaskId[];
  /** Suggested short bubble text for UI feedback (may be undefined). */
  bubble?: string;
  /** Temporary machine state to display. */
  tempState?: PetMachineState;
};

export type TimeProgressResult = {
  pet: PetState;
  leveledUp: boolean;
  newLevel?: number;
  completedTaskIds: DailyTaskId[];
  dayRolledOver: boolean;
};

export type CharacterEffectName = 'hop' | 'peek' | 'curl' | 'stretch' | 'gaze' | 'doze';

export type RandomEventTag =
  | 'happy'
  | 'hungry'
  | 'sleepy'
  | 'sleeping'
  | 'affection'
  | 'moody'
  | 'calm'
  | 'morning'
  | 'night'
  | 'idle'
  | 'peek'
  | 'stretch'
  | 'playing'
  | 'hop'
  | 'curious';

export type RandomEventDef = {
  id: string;
  /** Machine state shown while the event plays. */
  state: PetMachineState;
  /** Extra CSS effect class applied to the character. */
  effect?: CharacterEffectName;
  bubble?: string;
  durationMs: number;
  tags: readonly RandomEventTag[];
  baseWeight: number;
};

export type ClickReactionDef = {
  id: string;
  effect: 'wiggle' | 'hop' | 'spin';
  bubble?: string;
};
