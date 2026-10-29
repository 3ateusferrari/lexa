import React from 'react';
import { EXAMPLE_QUESTIONS_UI } from '../lib/chat-stream.js';

interface ExampleQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export const ExampleQuestions: React.FC<ExampleQuestionsProps> = ({
  onSelect,
  disabled
}) => {
  return (
    <section className="card" aria-label="Perguntas de exemplo">
      <h2 className="examples-title">
        Perguntas de Exemplo (Clique para testar com resposta imediata)
      </h2>
      <div className="examples-grid">
        {EXAMPLE_QUESTIONS_UI.map((item) => (
          <button
            key={item.id}
            type="button"
            className="example-pill"
            disabled={disabled}
            onClick={() => onSelect(item.question)}
          >
            <span className="example-category">{item.category}</span>
            {item.question}
          </button>
        ))}
      </div>
    </section>
  );
};
