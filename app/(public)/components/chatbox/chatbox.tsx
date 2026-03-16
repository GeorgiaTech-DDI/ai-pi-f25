import { Button } from "components/ui/Button";
import { ArrowUp } from "lucide-react";

import { Textbox } from "components/ui/Textbox/Textbox";
import styles from "./chatbox.module.css";

export default function Chatbox() {
  return (
    <div className={styles.container}>
      <Textbox className={styles.textbox} placeholder="Ask AI PI" />
      <Button variant="icon" ghost>
        <ArrowUp />
      </Button>
    </div>
  );
}
