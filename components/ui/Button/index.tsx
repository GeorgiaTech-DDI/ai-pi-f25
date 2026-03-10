import { Button as BaseButton } from "@base-ui/react";
import type { ComponentProps } from "react";
import styles from "./index.module.css";

export default function Button(props: ComponentProps<typeof BaseButton>) {
  return <BaseButton {...props} className={styles.Button} />;
}
