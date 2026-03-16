import { useForm, Controller } from "react-hook-form";
import { Button } from "components/ui/Button";
import { ArrowUp } from "lucide-react";
import { Field } from "components/ui/Field";
import { Textbox } from "components/ui/Textbox/Textbox";
import styles from "./chatbox.module.css";
import clsx from "clsx";

export default function Chatbox({
  className,
  onSubmit,
}: {
  className?: string;
  onSubmit: (val: string) => void;
}) {
  const { control, handleSubmit, reset } = useForm({
    defaultValues: { message: "" },
  });

  const onInternalSubmit = (data: { message: string }) => {
    if (!data.message.trim()) return;
    onSubmit(data.message);
    reset();
  };

  return (
    <form
      className={clsx(styles.container, className)}
      onSubmit={handleSubmit(onInternalSubmit)}
    >
      <Field className={styles.field}>
        <Controller
          name="message"
          control={control}
          render={({ field }) => (
            <Textbox
              {...field}
              placeholder="Ask AI PI"
              className={styles.textbox}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(onInternalSubmit)();
                }
              }}
            />
          )}
        />
      </Field>

      <Button type="submit" variant="icon" ghost>
        <ArrowUp />
      </Button>
    </form>
  );
}
