import { Button } from "components/ui/Button";
import { ArrowUp } from "lucide-react";

export default function Chatbox() {
  return (
    <div>
      <textarea placeholder="Ask any question about the Invention Studio..." />
      <Button variant="icon" ghost>
        <ArrowUp />
      </Button>
    </div>
  );
}
