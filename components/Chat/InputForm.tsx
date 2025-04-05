import React, { useState } from "react";
import styles from "../../styles/Chat.module.css";

interface InputFormProps {
  loading: boolean;
  onSubmit: (message: string) => void;
}

const InputForm: React.FC<InputFormProps> = ({ loading, onSubmit }) => {
  const [inputMessage, setInputMessage] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputMessage.trim()) return;

    onSubmit(inputMessage);
    setInputMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className={styles.inputForm}>
      <input
        type="text"
        placeholder="Ask your question"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        required
      />
      <button type="submit" disabled={loading} className={styles.sendButton}>
        {loading ? (
          <div className={styles.typingIndicatorSend}>
            <span className={styles.bounce}></span>
            <span className={styles.bounce}></span>
            <span className={styles.bounce}></span>
          </div>
        ) : (
          "Send"
        )}
      </button>
    </form>
  );
};

export default InputForm;
