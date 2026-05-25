"use client";

import { useState } from 'react';

interface Question {
  id: string;
  text: string;
  options: any[]; // Support both string[] and Option[]
}

interface QuizProps {
  courseId: string;
  lessonId: string;
  questions: Question[];
  onComplete?: (score: number) => void;
}

export default function QuizForm({ courseId, lessonId, questions, onComplete }: QuizProps) {
  const [answers, setAnswers] = useState<number[]>(new Array(questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const handleSelect = (qIndex: number, optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[qIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (answers.some((a) => a === -1)) {
      alert('Please answer all questions');
      return;
    }

    try {
      const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (res.ok) {
        const data = await res.json();
        setScore(data.score);
        setSubmitted(true);
        onComplete?.(data.score);
      } else {
        alert('Failed to submit quiz');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-bold">Quiz</h3>
      {questions.map((q, qIndex) => (
        <div key={q.id} className="space-y-2">
          <p className="font-medium">{qIndex + 1}. {q.text}</p>
          <div className="space-y-1 pl-4">
            {q.options.map((opt, optIndex) => (
              <div key={optIndex} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={`question-${qIndex}`}
                  checked={answers[qIndex] === optIndex}
                  onChange={() => handleSelect(qIndex, optIndex)}
                  disabled={submitted}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label 
                  onClick={() => !submitted && handleSelect(qIndex, optIndex)}
                  className={`cursor-pointer ${submitted && answers[qIndex] === optIndex ? "font-bold" : ""}`}
                >
                  {typeof opt === 'string' ? opt : opt.text}
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!submitted && (
        <button
          onClick={handleSubmit}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
        >
          Submit Quiz
        </button>
      )}

      {submitted && score !== null && (
        <div className={`p-4 rounded text-center font-bold ${score >= 70 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          Score: {score}%
        </div>
      )}
    </div>
  );
}
