"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCoachComment } from "@/lib/actions/workouts";

export function CommentForm({ scheduledWorkoutId }: { scheduledWorkoutId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    startTransition(async () => {
      await addCoachComment(scheduledWorkoutId, comment);
      setComment("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escribe un comentario para el atleta..."
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Enviando..." : "Comentar"}
      </button>
    </form>
  );
}
