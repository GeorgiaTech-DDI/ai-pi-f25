import { Button } from "components/ui/Button";
import { ArrowUp } from "lucide-react";

import styles from "./chatbox.module.css";
import { Form } from "components/ui/Form";
import { Field } from "components/ui/Field";
import { Textbox } from "components/ui/Textbox/Textbox";
import clsx from "clsx";
import { BaseUIEvent } from "@base-ui/react/utils/types";

export default function Chatbox({
  className,
  onSubmit,
}: {
  className?: string;
  onSubmit: (userInput: string) => void;
}) {
  const handleFormSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const message = formData.get("message") as string;

    if (message?.trim()) {
      onSubmit(message);
      event.currentTarget.reset();
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event.currentTarget.value);
    }
  };

  return (
    <Form
      className={clsx(styles.container, className)}
      onSubmit={handleFormSubmit}
    >
      <Field className={styles.field}>
        <Field.Control
          type="text"
          placeholder="Ask AI PI"
          render={(props) => (
            <Textbox
              {...props}
              className={styles.textbox}
              onKeyDown={handleKeyDown}
            />
          )}
        />
        <Field.Error />
      </Field>
      <Button variant="icon" ghost type="submit">
        <ArrowUp />
      </Button>
    </Form>
  );
}
