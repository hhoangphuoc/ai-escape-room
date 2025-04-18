import React, { useState, useEffect, useRef } from 'react';

const TerminalUI = () => {
  const [history, setHistory] = useState([]);
  const [command, setCommand] = useState("");
  const historyEndRef = useRef(null);

  // Scroll to the bottom when new messages are added
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Send command to backend API
  const sendCommand = async (cmd) => {
    try {
      const response = await fetch('http://localhost:3001/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error("Error sending command:", error);
      return "Error communicating with server.";
    }
  };

  const handleCommand = async (e) => {
    if (e.key === 'Enter' && command.trim() !== '') {
      // Add user command to history log
      setHistory(prev => [...prev, { type: 'command', text: command }]);
      const responseText = await sendCommand(command);
      setHistory(prev => [...prev, { type: 'response', text: responseText }]);
      setCommand("");
    }
  };

  return (
    <div className="w-full max-w-2xl bg-gray-800 text-green-400 font-mono p-4 rounded shadow-xl h-[80vh] flex flex-col">
      <div className="flex-grow overflow-y-auto mb-4">
        {history.map((item, index) => (
          <div key={index} className="mb-2">
            {item.type === 'command' && <span className="text-yellow-500">&gt; </span>}
            {item.text}
          </div>
        ))}
        <div ref={historyEndRef}></div>
      </div>
      <input
        type="text"
        className="bg-gray-700 p-2 rounded focus:outline-none"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={handleCommand}
        placeholder="Type a command (e.g., /help) and press Enter..."
      />
    </div>
  );
};

export default TerminalUI;