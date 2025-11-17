# xterm.js Terminal Integration

## Overview

The Core Vibe HQ platform now integrates xterm.js for enhanced terminal observability and user experience. This provides a full-featured terminal emulator directly in the browser for real-time command execution and output display.

## Features

### Core Terminal Emulator
- **Full xterm.js Integration**: Complete terminal emulation with VT100/ANSI support
- **Real-time Streaming**: Live output from containers via PartyServer WebSocket connections
- **Interactive Input**: Direct command input through the terminal interface
- **Visual Themes**: Cloudflare-branded dark theme with proper contrast and readability

### Addons and Enhancements
- **Fit Addon**: Automatic terminal resizing to fit container dimensions
- **Web Links Addon**: Clickable links in terminal output
- **Search Addon**: Find and highlight text within terminal output
- **Custom Scrollbars**: Styled scrollbars matching the application theme

### Connection Management
- **PartyServer Integration**: Uses existing PartyServer infrastructure for WebSocket connections
- **Auto-reconnection**: Automatic reconnection with exponential backoff on connection failures
- **Connection Status**: Visual indicators for connection state (connecting, connected, disconnected, error)
- **Graceful Fallback**: Falls back to basic text display if xterm.js fails to load

## Implementation Details

### Component Architecture

```typescript
// Terminal component with xterm.js integration
export function Terminal({
  workerId,
  sandboxId
}: TerminalProps) {
  // xterm.js terminal instance
  const xtermInstanceRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // PartySocket connection for data streaming
  const socketRef = useRef<PartySocket | null>(null);
}
```

### Terminal Initialization

```typescript
useEffect(() => {
  const term = new XTerm({
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'JetBrains Mono, Fira Code, Consolas, Monaco, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.2,
    letterSpacing: 0.5,
    scrollback: 10000,
    tabStopWidth: 4,
    theme: {
      background: '#1d1e1e',
      foreground: '#d4d4d4',
      cursor: '#f6821f', // Cloudflare orange
      // ... color scheme
    },
  });

  // Add addons
  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  const searchAddon = new SearchAddon();

  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);
  term.loadAddon(searchAddon);

  // Open terminal in DOM
  term.open(xtermRef.current);
}, []);
```

### Data Flow

1. **User Input**: Commands typed directly in xterm.js terminal
2. **WebSocket Transmission**: Commands sent via PartySocket to TerminalServer
3. **Container Execution**: TerminalServer forwards commands to container via sandbox
4. **Output Streaming**: Container stdout/stderr streamed back through WebSocket
5. **Terminal Display**: Output rendered in xterm.js with proper ANSI formatting

### Message Handling

```typescript
// Handle different message types
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'log') {
    // Write to xterm.js terminal
    xtermInstanceRef.current?.write(data.content);
  } else if (data.type === 'container-connected') {
    // Show connection message
    xtermInstanceRef.current?.write(`\r\n${data.message}\r\n$ `);
  }
});
```

## Configuration

### Environment Variables
- `WORKER_NAME`: Identifies the worker for health monitoring
- `WORKER_TYPE`: Worker type (factory, specialist, etc.)
- `HEALTH_WORKER_TARGETS`: JSON array of worker targets for health checks

### Wrangler Configuration
```jsonc
{
  "vars": {
    "WORKER_NAME": "agent-factory",
    "WORKER_TYPE": "factory",
    "HEALTH_WORKER_TARGETS": "[{\"name\":\"agent-factory\",\"type\":\"factory\"}]"
  }
}
```

## Usage

### For Users
1. **Open Terminal**: Navigate to Mission Control or chat interface with terminal component
2. **Connect**: Terminal automatically connects to container when worker is active
3. **Execute Commands**: Type commands directly in the terminal emulator
4. **View Output**: Real-time streaming of command output with proper formatting

### For Developers
1. **Import Component**: Use the Terminal component in React applications
2. **Configure Connection**: Provide workerId and optional sandboxId props
3. **Handle Events**: Listen for connection status and error events
4. **Customize Theme**: Override terminal theme and configuration as needed

## Troubleshooting

### xterm.js Not Loading
- **Symptom**: Terminal shows basic text fallback instead of full emulator
- **Cause**: xterm.js package not installed or failed to load
- **Solution**: Ensure xterm.js dependencies are installed and CSS is imported

### Connection Issues
- **Symptom**: Terminal shows "disconnected" or "error" status
- **Cause**: PartyServer connection failed or container not available
- **Solution**: Check PartyServer configuration and container health

### Performance Issues
- **Symptom**: Terminal lag or slow rendering
- **Cause**: Large scrollback buffer or excessive output
- **Solution**: Adjust scrollback size or implement output throttling

## Security Considerations

### Input Sanitization
- All user input is validated before transmission
- Commands are limited to safe container operations
- No direct shell access or privileged commands allowed

### Connection Security
- WebSocket connections use PartyServer authentication
- Container isolation prevents cross-worker access
- Health check endpoints are protected by authentication

## Future Enhancements

### Planned Features
- **Terminal History**: Persistent command history across sessions
- **Tab Completion**: Auto-completion for common commands
- **File Upload/Download**: Drag-and-drop file operations
- **Split Panes**: Multiple terminal sessions in one view
- **Recording/Playback**: Session recording and playback capabilities

### Performance Optimizations
- **Output Buffering**: Batch terminal output for smoother rendering
- **Lazy Loading**: Load xterm.js only when terminal is needed
- **Memory Management**: Automatic cleanup of large scrollback buffers

## Related Documentation

- [Terminal API Routes](../api/terminal-api.md)
- [PartyServer Integration](../development/partyserver-integration.md)
- [Container Terminal Setup](../deployment/container-terminal-setup.md)
- [Health Check System](../monitoring/health-check-system.md)
