import { useState, useRef, useEffect } from "react";
import { Send, ImagePlus, Loader2, Bot, User } from "lucide-react";

const GROQ_API_KEY = "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";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

type Message = {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  displayContent: string;
};

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImage(base64);
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed && !image) return;

    let userContent: any;
    let displayContent = trimmed;

    if (image) {
      userContent = [];
      if (trimmed) userContent.push({ type: "text", text: trimmed });
      userContent.push({ type: "image_url", image_url: { url: image } });
      displayContent = trimmed || "[Image]";
    } else {
      userContent = trimmed;
    }

    const userMsg: Message = { role: "user", content: userContent, displayContent };
    const userImagePreview = imagePreview;

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    removeImage();
    setIsLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          temperature: 1,
          max_completion_tokens: 1024,
          top_p: 1,
          stream: true,
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Groq API error ${resp.status}: ${err}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", displayContent: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              const snap = assistantText;
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1
                    ? { ...m, content: snap, displayContent: snap }
                    : m
                )
              );
            }
          } catch {}
        }
      }
    } catch (e: any) {
      console.error(e);
      setMessages((prev) => [
        ...prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.displayContent)),
        { role: "assistant", content: `Error: ${e.message}`, displayContent: `Error: ${e.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[hsl(220,20%,97%)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[hsl(220,25%,14%)] text-white shadow-md">
        <Bot className="w-7 h-7 text-[hsl(160,60%,55%)]" />
        <div>
          <h1 className="text-base font-semibold leading-tight">Groq Vision Chat</h1>
          <p className="text-xs text-white/50">llama-4-scout · OCR & Vision</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60 gap-3">
            <Bot className="w-12 h-12 text-[hsl(220,15%,60%)]" />
            <p className="text-sm text-[hsl(220,10%,45%)] max-w-[240px]">
              Send a message or upload an image to analyze with Groq Vision
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[hsl(220,25%,14%)] flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-[hsl(160,60%,55%)]" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-[hsl(220,25%,14%)] text-white rounded-br-md"
                  : "bg-white text-[hsl(220,20%,20%)] shadow-sm border border-[hsl(220,15%,90%)] rounded-bl-md"
              }`}
            >
              {msg.role === "user" &&
                Array.isArray(msg.content) &&
                msg.content.some((c: any) => c.type === "image_url") && (
                  <img
                    src={(msg.content as any[]).find((c: any) => c.type === "image_url")?.image_url?.url}
                    alt="Uploaded"
                    className="rounded-lg mb-2 max-h-40 w-auto"
                  />
                )}
              {msg.displayContent}
              {msg.role === "assistant" && !msg.displayContent && isLoading && (
                <span className="inline-block w-1.5 h-4 bg-[hsl(220,25%,14%)] animate-pulse rounded-sm" />
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-[hsl(160,60%,45%)] flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 pb-1">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-16 rounded-lg border border-[hsl(220,15%,85%)]" />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none active:scale-95"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-end gap-2 bg-white rounded-2xl shadow-sm border border-[hsl(220,15%,88%)] p-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[hsl(220,15%,55%)] hover:bg-[hsl(220,20%,95%)] active:scale-95 transition-colors flex-shrink-0"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about an image..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm py-2 px-1 outline-none text-[hsl(220,20%,20%)] placeholder:text-[hsl(220,10%,65%)] max-h-28"
            style={{ overflow: "auto" }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !image)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[hsl(220,25%,14%)] text-white disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
