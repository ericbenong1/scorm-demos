/**
 * ==============================================================================
 * SCORM BRIDGE (scorm_bridge.js)
 * ==============================================================================
 * 
 * THE "SENDER" SIDE OF THE POSTMESSAGE BRIDGE
 * ============================================
 * 
 * This script runs in your EXTERNAL content (hosted on your server, outside
 * the SCORM package). It provides a simple interface for sending SCORM commands
 * to the parent SCORM wrapper.
 * 
 * WHY IS THIS NEEDED?
 * -------------------
 * Your content is loaded in an iframe, running on a different domain than the LMS.
 * You can't directly call the SCORM API (browser security blocks it).
 * 
 * Instead, you use window.postMessage() to send commands to the parent window
 * (the SCORM wrapper), which DOES have access to the SCORM API.
 * 
 * USAGE IN YOUR CONTENT:
 * ----------------------
 * Just include this script and call the functions when needed:
 * 
 *   <script src="scorm_bridge.js"></script>
 *   <script>
 *     // When the learner completes the content:
 *     sendSCORMCompletion();
 *   </script>
 */

/* ===========================================================================
 * CONFIGURATION
 * =========================================================================== */

/**
 * TARGET ORIGIN FOR POSTMESSAGE
 * =============================
 * 
 * For security, you should specify the exact origin of the parent window.
 * Since we're in a SCORM package loaded by various LMS systems, we often
 * don't know the exact parent origin in advance.
 * 
 * OPTIONS:
 *   - Use '*' to send to any origin (less secure, but works with any LMS)
 *   - Hardcode specific LMS origins if known (more secure)
 *   - Dynamically detect parent origin (complex, but possible)
 * 
 * For this demo, we use '*' for maximum compatibility.
 * In production, consider detecting and validating the parent origin.
 */
const PARENT_ORIGIN = '*';  // Accept any parent origin (for compatibility)

/**
 * DEBUG MODE
 * ==========
 * Set to true to see detailed console logs.
 */
const DEBUG_MODE = true;

/**
 * MESSAGE TIMEOUT
 * ===============
 * How long to wait for acknowledgment before considering the message failed.
 * (In milliseconds)
 */
const ACK_TIMEOUT = 5000;  // 5 seconds

/* ===========================================================================
 * MESSAGE TRACKING
 * =========================================================================== */

/**
 * Track message statistics for the demo UI
 */
let messagesSent = 0;
let acksReceived = 0;

/**
 * Map to track pending messages waiting for acknowledgment.
 * Key: messageId, Value: {resolve, reject, timeout} for the promise
 */
const pendingMessages = new Map();

/**
 * Generate unique message IDs for tracking.
 * Uses a simple incrementing counter + timestamp.
 */
let messageIdCounter = 0;
function generateMessageId() {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

/* ===========================================================================
 * LISTENING FOR ACKNOWLEDGMENTS
 * =========================================================================== */

/**
 * SET UP ACKNOWLEDGMENT LISTENER
 * ==============================
 * Listen for responses from the parent SCORM wrapper.
 * 
 * When we send a command (like 'setCompletion'), the parent should
 * send back an acknowledgment (type: 'SCORM_ACK') confirming receipt.
 * 
 * This listener:
 *   1. Receives the acknowledgment
 *   2. Resolves the corresponding promise
 *   3. Updates the UI (for this demo)
 */
window.addEventListener('message', function(event) {
  debugLog('📥 Received message from parent:', event.data);
  
  // Check if this is a SCORM acknowledgment
  if (!event.data || event.data.type !== 'SCORM_ACK') {
    debugLog('  ℹ️ Not a SCORM acknowledgment, ignoring');
    return;
  }
  
  acksReceived++;
  updateUICounters();
  
  // Update the message log in the UI (if the function exists)
  if (typeof logMessage === 'function') {
    logMessage('received', `ACK for ${event.data.command}: ${event.data.success ? '✅' : '❌'} ${event.data.message}`);
  }
  
  // Handle specific acknowledgments
  handleAcknowledgment(event.data);
});

/**
 * HANDLE ACKNOWLEDGMENT
 * =====================
 * Process the acknowledgment and take appropriate action.
 * 
 * @param {Object} ackData - The acknowledgment data from parent
 */
function handleAcknowledgment(ackData) {
  debugLog('🔔 Processing acknowledgment:', ackData);
  
  switch (ackData.command) {
    case 'setCompletion':
      // Update the status display (if the function exists in the page)
      if (typeof updateStatusDisplay === 'function') {
        updateStatusDisplay(ackData.success, ackData.message);
      }
      break;
      
    case 'ping':
      debugLog('  Pong received! SCORM wrapper is listening.');
      debugLog(`  SCORM API available: ${ackData.scormAvailable}`);
      break;
      
    default:
      debugLog(`  Unknown acknowledgment command: ${ackData.command}`);
  }
}

/* ===========================================================================
 * SENDING SCORM COMMANDS
 * =========================================================================== */

/**
 * SEND POSTMESSAGE TO PARENT
 * ==========================
 * Core function to send a message to the parent window.
 * 
 * HOW POSTMESSAGE WORKS:
 * ----------------------
 * window.parent.postMessage(message, targetOrigin)
 * 
 * - window.parent: The window that contains this iframe
 * - message: Any JSON-serializable data (objects, strings, arrays)
 * - targetOrigin: Security check - must match the parent's origin (or '*')
 * 
 * SECURITY NOTE:
 * Using '*' as targetOrigin means the message goes to ANY parent.
 * This is necessary for SCORM because we don't always know the LMS origin.
 * However, for sensitive data, you should specify the exact origin.
 * 
 * @param {Object} message - The message data to send
 */
function sendToParent(message) {
  // Check if we're actually in an iframe
  if (window.parent === window) {
    console.warn('⚠️ Not in an iframe - cannot send to parent');
    return false;
  }
  
  debugLog('📤 Sending to parent:', message);
  
  try {
    // Send the message to the parent window
    window.parent.postMessage(message, PARENT_ORIGIN);
    
    messagesSent++;
    updateUICounters();
    
    // Log to UI
    if (typeof logMessage === 'function') {
      logMessage('sent', `${message.command}: ${JSON.stringify(message.data || {})}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send message to parent:', error);
    return false;
  }
}

/**
 * SEND SCORM COMPLETION
 * =====================
 * The main function you'll call when the learner completes your content.
 * 
 * This sends a 'setCompletion' command to the SCORM wrapper, which will
 * then call the LMS API to record the completion.
 * 
 * USAGE:
 *   sendSCORMCompletion();
 * 
 * Or in a button:
 *   <button onclick="sendSCORMCompletion()">Mark Complete</button>
 */
function sendSCORMCompletion() {
  debugLog('🎉 Sending completion signal...');
  
  const message = {
    // 'type' identifies this as a SCORM command (for filtering on the receiving end)
    type: 'SCORM_COMMAND',
    
    // 'command' specifies what action to take
    command: 'setCompletion',
    
    // 'data' contains any additional information
    data: {
      status: 'completed',
      timestamp: new Date().toISOString()  // For debugging/logging
    }
  };
  
  return sendToParent(message);
}

/**
 * SEND SCORM PING
 * ===============
 * Tests the connection to the SCORM wrapper.
 * Useful for verifying that communication is working before
 * the learner tries to complete.
 * 
 * USAGE:
 *   sendSCORMPing();
 */
function sendSCORMPing() {
  debugLog('🏓 Sending ping to parent...');
  
  const message = {
    type: 'SCORM_COMMAND',
    command: 'ping',
    data: {
      timestamp: new Date().toISOString()
    }
  };
  
  return sendToParent(message);
}

/* ===========================================================================
 * BEFOREUNLOAD HANDLING
 * =========================================================================== */

/**
 * HANDLE WINDOW CLOSE
 * ===================
 * If the learner closes the course before clicking "complete",
 * we have a chance to send a final message.
 * 
 * NOTE: This is NOT reliable! The browser may or may not allow
 * the postMessage to complete before closing. Don't depend on this
 * for critical data - it's just a backup.
 * 
 * Better UX patterns:
 *   - Auto-save progress periodically
 *   - Require explicit completion before allowing close
 *   - Show a confirmation dialog
 */
window.addEventListener('beforeunload', function(event) {
  debugLog('👋 Window is closing...');
  
  // We could try to send a "suspend" signal here, but it's unreliable
  // Instead, just log for demo purposes
  debugLog('⚠️ Note: In a real course, you might want to save progress here');
  
  // Example of what you COULD do (but don't depend on it):
  // sendToParent({
  //   type: 'SCORM_COMMAND',
  //   command: 'setSuspendData',
  //   data: { lastPosition: 'page3', progress: 75 }
  // });
});

/* ===========================================================================
 * UTILITY FUNCTIONS
 * =========================================================================== */

/**
 * DEBUG LOGGING
 * =============
 * Conditional logging that only outputs when DEBUG_MODE is true.
 * 
 * @param {...any} args - Arguments to pass to console.log
 */
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log('[SCORM Bridge]', ...args);
  }
}

/**
 * UPDATE UI COUNTERS
 * ==================
 * Updates the message/ack counters in the demo UI.
 */
function updateUICounters() {
  const sentEl = document.getElementById('messages-sent');
  const acksEl = document.getElementById('acks-received');
  
  if (sentEl) sentEl.textContent = messagesSent;
  if (acksEl) acksEl.textContent = acksReceived;
}

/* ===========================================================================
 * INITIALIZATION
 * =========================================================================== */

console.log('[SCORM Bridge] Script loaded and ready!');
console.log('[SCORM Bridge] Available functions:');
console.log('  - sendSCORMCompletion() : Mark the course as complete');
console.log('  - sendSCORMPing() : Test connection to SCORM wrapper');

/* ===========================================================================
 * EXPLANATION: WHY USE POSTMESSAGE?
 * =========================================================================== */

/**
 * THE CROSS-ORIGIN PROBLEM
 * ========================
 * 
 * Imagine this scenario:
 * - LMS is at: https://lms.company.com
 * - Your content is at: https://yoursite.github.io
 * 
 * When your content tries to access something in the parent window:
 * 
 *   // This will FAIL with a security error!
 *   window.parent.document.getElementById('something');
 *   
 *   // This will also FAIL!
 *   window.parent.API.LMSSetValue('cmi.core.lesson_status', 'completed');
 * 
 * The browser blocks these because they cross origin boundaries.
 * 
 * THE POSTMESSAGE SOLUTION
 * ========================
 * 
 * postMessage is specifically designed for secure cross-origin communication.
 * It works because:
 * 
 * 1. The sender explicitly sends to a known parent/window
 * 2. The receiver can validate the origin of incoming messages
 * 3. No direct access to the other window's DOM or JavaScript objects
 * 
 *   // This WORKS across origins!
 *   window.parent.postMessage({ action: 'complete' }, '*');
 * 
 * The trade-off is that communication becomes ASYNCHRONOUS and MESSAGE-BASED
 * instead of direct function calls. But that's actually a good design pattern!
 */
