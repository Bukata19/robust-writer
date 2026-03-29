// Updated Chat Sidebar section in EditorPage.tsx

import React from 'react';

const ChatSidebar = () => {
    return (
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Other components and chat messages */}
            <div style={{ flexGrow: 1, maxHeight: 'calc(100% - 60px)', overflowY: 'auto' }}>
                {/* Chat messages go here */}
            </div>
            {/* Keyboard input field */}
            <div style={{ height: '60px' }}>
                {/* Input component */}
            </div>
        </div>
    );
};

export default ChatSidebar;