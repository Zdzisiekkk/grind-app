import { TodosScreen } from "@/components/todos/TodosScreen";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type { Todo, TodoList } from "@/lib/database.types";

export const metadata = { title: "Zadania" };

export default async function TodosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: lists }, { data: todos }] = await Promise.all([
    supabase
      .from("todo_lists")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("order_index")
      .order("created_at"),
    supabase
      .from("todos")
      .select("*")
      .eq("user_id", user.id)
      .order("order_index")
      .order("created_at"),
  ]);

  return (
    <TodosScreen
      userId={user.id}
      lists={(lists ?? []) as TodoList[]}
      todos={(todos ?? []) as Todo[]}
      today={todayISO()}
    />
  );
}
