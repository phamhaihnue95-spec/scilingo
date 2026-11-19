import { motion } from "framer-motion";
import { Award, Crown, Flame, Medal, Sparkles, Trophy } from "lucide-react";

import type { ClassroomLeaderboard } from "../../api/types";

interface Props {
  leaderboard: ClassroomLeaderboard | null;
  currentUserId?: string;
  loading?: boolean;
  compact?: boolean;
}

const PODIUM_STYLE = [
  {
    orderClass: "order-2 sm:order-1",
    ring: "border-slate-300 bg-gradient-to-b from-slate-50 to-white",
    badge: "bg-slate-200 text-slate-800",
    label: "Hạng #2",
  },
  {
    orderClass: "order-1 sm:order-2 sm:-mt-3",
    ring: "border-amber-400 bg-gradient-to-b from-amber-50 via-yellow-50/70 to-white ring-2 ring-amber-200",
    badge: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    label: "Quán Quân #1",
  },
  {
    orderClass: "order-3",
    ring: "border-orange-200 bg-gradient-to-b from-orange-50/70 to-white",
    badge: "bg-orange-100 text-orange-800",
    label: "Hạng #3",
  },
];

export function ClassroomLeaderboardPanel({
  leaderboard,
  currentUserId,
  loading = false,
  compact = false,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Đang tải bảng xếp hạng thi đua lớp...
      </div>
    );
  }

  if (!leaderboard) {
    return null;
  }

  const topThree = leaderboard.entries.slice(0, 3);
  const podiumOrder =
    topThree.length >= 2
      ? [topThree[1], topThree[0], ...(topThree[2] ? [topThree[2]] : [])]
      : topThree;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 sm:text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            Bảng Vàng Thi Đua · {leaderboard.classroom_name}
          </h3>
          <p className="text-xs text-slate-500">
            Mã lớp <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono font-bold text-indigo-700">{leaderboard.join_code}</code>{" "}
            · {leaderboard.total_students} học sinh tham gia
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold text-amber-900">
          Xếp hạng theo XP &amp; Streak
        </span>
      </div>

      {/* Podium for Top 3 */}
      {!compact && podiumOrder.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {podiumOrder.map((entry) => {
            const style =
              entry.rank === 1
                ? PODIUM_STYLE[1]
                : entry.rank === 2
                  ? PODIUM_STYLE[0]
                  : PODIUM_STYLE[2];
            const isMe = currentUserId === entry.student_id;

            return (
              <motion.div
                key={entry.student_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-3xl border p-4 text-center shadow-sm ${style.orderClass} ${style.ring}`}
              >
                <div className="flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[11px] font-black ${style.badge}`}
                  >
                    {entry.rank === 1 ? <Crown className="h-3.5 w-3.5" /> : <Medal className="h-3.5 w-3.5" />}
                    {style.label}
                  </span>
                </div>
                <div className="mt-2.5 text-base font-extrabold text-slate-900">
                  {entry.student_name}
                  {isMe && (
                    <span className="ml-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      Bạn
                    </span>
                  )}
                </div>
                <div className="mt-1 text-2xl font-black text-indigo-700">
                  {entry.total_xp} <span className="text-xs font-bold">XP</span>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-bold text-slate-600">
                  <span>Lv.{entry.level}</span>
                  <span className="inline-flex items-center gap-0.5 text-orange-600">
                    <Flame className="h-3.5 w-3.5" />
                    {entry.current_streak}d
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-fuchsia-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    {entry.scidex_count}/16
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard Table */}
      {leaderboard.entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
          Lớp chưa có học sinh tham gia. Chia sẻ mã{" "}
          <strong className="text-indigo-700">{leaderboard.join_code}</strong> cho học sinh để bắt đầu thi đua!
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500">
                <th className="px-3.5 py-2.5">Hạng</th>
                <th className="px-3.5 py-2.5">Học sinh</th>
                <th className="px-3.5 py-2.5">Level / XP</th>
                <th className="px-3.5 py-2.5">Streak</th>
                <th className="px-3.5 py-2.5">SciDex 3D</th>
                <th className="px-3.5 py-2.5">Huy hiệu</th>
                <th className="px-3.5 py-2.5">TB Đề TT94</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.entries.map((entry) => {
                const isMe = currentUserId === entry.student_id;
                return (
                  <tr
                    key={entry.student_id}
                    className={isMe ? "bg-indigo-50/70 font-semibold" : "hover:bg-slate-50/70"}
                  >
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                          entry.rank === 1
                            ? "bg-amber-400 text-amber-950"
                            : entry.rank === 2
                              ? "bg-slate-300 text-slate-900"
                              : entry.rank === 3
                                ? "bg-orange-200 text-orange-950"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">
                      {entry.student_name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                          Bạn
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs">
                      <span className="font-extrabold text-indigo-700">{entry.total_xp} XP</span>{" "}
                      <span className="text-slate-500">· Lv.{entry.level}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-xs font-bold text-orange-600">
                      {entry.current_streak} ngày
                    </td>
                    <td className="px-3.5 py-2.5 text-xs font-bold text-fuchsia-700">
                      {entry.scidex_count}/16
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-slate-700">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Award className="h-3.5 w-3.5 text-amber-500" />
                        {entry.badges_count}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-xs font-semibold text-teal-700">
                      {entry.avg_assignment_score !== null ? `${entry.avg_assignment_score}/10` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] font-medium text-slate-500">
        Lưu ý sư phạm: Điểm XP &amp; thứ hạng thi đua trò chơi giúp tăng động lực học từ vựng KHTN,
        hoàn toàn tách biệt với điểm kiểm tra định kỳ theo Thông tư 94/2026/TT-BGDĐT.
      </p>
    </div>
  );
}
