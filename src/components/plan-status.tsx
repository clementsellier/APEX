import { getFormatter, getTranslations } from "next-intl/server";
import type { PlanStatus } from "@/generated/prisma/enums";
import type { HistoryEvent } from "@/lib/plan-workflow";

type Audience = "field" | "manager";

const TONES = {
  amber: "bg-amber-500/10 text-amber-900 dark:text-amber-200",
  indigo: "bg-indigo-500/10 text-indigo-900 dark:text-indigo-200",
  green: "bg-green-500/10 text-green-900 dark:text-green-200",
  neutral: "bg-foreground/5 text-foreground/80",
};

/**
 * Bandeau d'état du plan, déduit du statut et du dernier événement de l'historique.
 * Renvoie null quand il n'y a rien à signaler (plan en création, jamais renvoyé).
 */
export async function PlanNotice({
  status,
  history,
  audience,
}: {
  status: PlanStatus;
  history: HistoryEvent[];
  audience: Audience;
}) {
  const [t, format] = await Promise.all([getTranslations("Workflow"), getFormatter()]);
  const last = history[0];
  const when = (e: HistoryEvent) => format.dateTime(e.date, { dateStyle: "long" });

  // Le manager a-t-il modifié le plan juste avant sa décision ?
  const editedByManager = history[1]?.action === "UPDATED_BY_MANAGER";
  // Pendant la revue, le dernier événement peut être une modification du manager.
  const submitted = history.find((e) => e.action === "SUBMITTED");

  let tone: keyof typeof TONES;
  let message: string;
  let comment: HistoryEvent | undefined;

  if (status === "IN_CREATION") {
    if (last?.action !== "RETURNED") return null;
    tone = "amber";
    message = t(`notice.returned.${audience}`, { name: last.actor, date: when(last) });
    comment = last;
  } else if (status === "IN_VALIDATION" && submitted) {
    tone = "indigo";
    message = t(`notice.submitted.${audience}`, { name: submitted.actor, date: when(submitted) });
    comment = submitted;
  } else if (status === "VALIDATED" && last?.action === "VALIDATED") {
    tone = "green";
    message = t(`notice.validated.${audience}`, { name: last.actor, date: when(last) });
    comment = last;
  } else {
    tone = audience === "field" ? "amber" : "neutral";
    message = t(`notice.readOnly.${audience}`);
  }
  const showEdited =
    editedByManager && (last?.action === "VALIDATED" || last?.action === "RETURNED");

  return (
    <div role="status" className={`rounded-xl px-4 py-3 text-sm ${TONES[tone]}`}>
      <p>
        {message}
        {showEdited && <> {t(`notice.edited.${audience}`)}</>}
      </p>
      {comment?.comment && (
        <blockquote className="mt-2 border-l-2 border-current/30 pl-3 whitespace-pre-line italic">
          {comment.comment}
        </blockquote>
      )}
    </div>
  );
}

const GOAL_KEYS = ["goalCall", "goalEvtAtt", "goalAemail"] as const;

const DOTS: Record<HistoryEvent["action"], string> = {
  CREATED: "bg-foreground/40",
  SUBMITTED: "bg-indigo-500",
  VALIDATED: "bg-green-500",
  RETURNED: "bg-amber-500",
  UPDATED_BY_MANAGER: "bg-fuchsia-500",
};

/** Historique du plan (création, envois, modifications du manager, décisions), du plus récent au plus ancien. */
export async function PlanHistory({ history }: { history: HistoryEvent[] }) {
  if (history.length === 0) return null;
  const [t, tPlan, format] = await Promise.all([
    getTranslations("Workflow"),
    getTranslations("PlanEditor"),
    getFormatter(),
  ]);

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">{t("history")}</h2>
      <ol className="relative flex flex-col gap-4 border-l border-black/10 pl-5 dark:border-white/15">
        {history.map((e) => (
          <li key={e.id} className="relative">
            <span
              className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-background ${DOTS[e.action]}`}
            />
            <p className="text-sm">
              <span className="font-medium">{t(`action.${e.action}`)}</span>
              <span className="text-foreground/60">
                {" "}
                · {e.actor} · {format.dateTime(e.date, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </p>
            {e.comment && (
              <p className="mt-1 text-sm whitespace-pre-line text-foreground/70">{e.comment}</p>
            )}
            {e.changes.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {e.changes.map((change) => (
                  <li key={change.name} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{change.name}</span>
                    {change.after === null ? (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-300">
                        {t("removed")}
                      </span>
                    ) : (
                      GOAL_KEYS.filter((k) => change.before[k] !== change.after![k]).map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-xs text-fuchsia-800 tabular-nums dark:text-fuchsia-200"
                        >
                          {tPlan(`short.${k}`)} {change.before[k]} → {change.after![k]}
                        </span>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
