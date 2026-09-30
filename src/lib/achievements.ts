import { Exam, Goal } from "@/types";

export interface AchievementContext {
  totalMinutes: number;
  sessionCount: number;
  bestStreak: number;
  completedGoals: number;
  exams: Exam[];
}

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  test: (c: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first-session", title: "First Study Session", description: "Log your first study session.", test: (c) => c.sessionCount >= 1 },
  { key: "streak-7", title: "7 Day Streak", description: "Study seven days in a row.", test: (c) => c.bestStreak >= 7 },
  { key: "hours-10", title: "10 Hours Studied", description: "Reach ten hours of total study time.", test: (c) => c.totalMinutes >= 600 },
  { key: "hours-50", title: "50 Hours Studied", description: "Reach fifty hours of total study time.", test: (c) => c.totalMinutes >= 3000 },
  { key: "hours-100", title: "100 Hours Studied", description: "Reach one hundred hours of total study time.", test: (c) => c.totalMinutes >= 6000 },
  { key: "goal-keeper", title: "Goal Keeper", description: "Complete a goal.", test: (c) => c.completedGoals >= 1 },
  { key: "exam-ready", title: "Exam Ready", description: "Mark an exam as at least 90% prepared.", test: (c) => c.exams.some((e) => e.preparationPct >= 90) },
];

export const completedGoalCount = (goals: Goal[]) => goals.filter((g) => g.status === "Completed").length;
