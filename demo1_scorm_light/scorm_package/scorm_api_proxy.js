/**
 * ==============================================================================
 * SCORM API PROXY (scorm_api_proxy.js)
 * ==============================================================================
 * 
 * THIS IS THE BRAIN OF THE SCORM WRAPPER
 * ======================================
 * This script handles all communication between your external content and the LMS.
 * 
 * Its responsibilities:
 *   1. Find the SCORM API in the LMS window hierarchy (the "API Hunt")
 *   2. Initialize the SCORM session when the course starts
 *   3. Listen for postMessage events from the external content iframe
 *   4. Relay completion status to the LMS
 *   5. Terminate the session when the course closes
 * 
 * SCORM 1.2 API METHODS:
 * ----------------------
 * LMSInitialize("")    - Start the session (MUST be called first)
 * LMSSetValue(el, val) - Set a data element (like completion status)
 * LMSGetValue(el)      - Get a data element value
 * LMSCommit("")        - Save data to the LMS database
 * LMSFinish("")        - End the session (MUST be called last)
 * LMSGetLastError()    - Get the last error code (0 = no error)
 * LMSGetErrorString(n) - Get human-readable error message
 * LMSGetDiagnostic(n)  - Get detailed diagnostic info
 * 
 * KEY DATA MODEL ELEMENTS (SCORM 1.2):
 * ------------------------------------
 * cmi.core.lesson_status  - "passed", "failed", "completed", "incomplete", etc.
 * cmi.core.score.raw      - The learner's score (0-100)
 * cmi.core.session_time   - How long they spent this session
 * cmi.suspend_data        - Custom data you want to save (bookmarking, etc.)
 */

/* ===========================================================================
 * CONFIGURATION
 * =========================================================================== */

/**
 * ALLOWED ORIGINS
 * ===============
 * For security, we only accept postMessages from these domains.
 * 
 * IMPORTANT: Update this list with YOUR actual domain(s)!
 * 
 * Format: Full origin including protocol (https://)
 * Example: 'https://mycompany.github.io'
 * 
 * Why this matters:
 * - Prevents malicious sites from sending fake completion signals
 * - Ensures only YOUR content can mark the course as complete
 */
const ALLOWED_ORIGINS = [
  'https://ericbenong1.github.io',  // Update with your GitHub Pages URL
  'http://localhost:5500',                    // For local testing with Live Server
  'http://127.0.0.1:5500',                    // Alternative localhost
  // Add more origins as needed for testing/production
];

/**
 * DEBUG MODE
 * ==========
 * Set to true to see detailed console logs.
 * Set to false for production to reduce console noise.
 */
const DEBUG_MODE = true;

/* ===========================================================================
 * GLOBAL STATE
 * =========================================================================== */

/**
 * Reference to the SCORM API object.
 * Will be null if not found (e.g., testing outside an LMS).
 */
let scormAPI = null;

/**
 * Track whether SCORM has been initialized.
 * Prevents calling LMSInitialize() multiple times.
 */
let isInitialized = false;

/**
 * Track whether the course has been marked complete.
 * Prevents sending completion multiple times.
 */
let isCompleted = false;

/* ===========================================================================
 * THE FAMOUS "API HUNT" - FINDING THE SCORM API
 * =========================================================================== */

/**
 * FIND SCORM API
 * ==============
 * This function searches for the SCORM API object in the window hierarchy.
 * 
 * WHY IS THIS NECESSARY?
 * ----------------------
 * When an LMS launches a SCORM course, it creates the API object in a window.
 * But your course might be:
 *   - Directly in the LMS frame
 *   - In an iframe inside the LMS
 *   - In a popup window opened by the LMS
 *   - Multiple iframes deep!
 * 
 * The API could be in ANY parent or opener window, so we have to search.
 * 
 * HOW THE HUNT WORKS:
 * -------------------
 * 1. Start at the current window
 * 2. Look for window.API (SCORM 1.2) or window.API_1484_11 (SCORM 2004)
 * 3. If not found, check window.parent (if we're in an iframe)
 * 4. If not found, check window.opener (if we're in a popup)
 * 5. Repeat up to MAX_HUNT_DEPTH levels to prevent infinite loops
 * 
 * @param {Window} startWindow - The window to start searching from
 * @returns {Object|null} - The SCORM API object, or null if not found
 */
function findSCORMAPI(startWindow) {
  // Maximum depth to search (prevents infinite loops in weird window setups)
  const MAX_HUNT_DEPTH = 10;
  
  let currentWindow = startWindow;
  let huntDepth = 0;
  let apiFound = null;
  
  debugLog('🔍 Starting API Hunt...');
  
  // STRATEGY 1: Search up the parent chain (for iframe embedding)
  while (currentWindow && huntDepth < MAX_HUNT_DEPTH) {
    huntDepth++;
    debugLog(`  Level ${huntDepth}: Checking window...`);
    
    // Look for SCORM 1.2 API
    if (currentWindow.API) {
      debugLog('  ✅ Found SCORM 1.2 API!');
      return currentWindow.API;
    }
    
    // Also check for SCORM 2004 API (for compatibility)
    if (currentWindow.API_1484_11) {
      debugLog('  ✅ Found SCORM 2004 API!');
      // Note: If using 2004, you'd need different method names (Initialize vs LMSInitialize)
      // This demo focuses on 1.2, but the hunt finds either
      return currentWindow.API_1484_11;
    }
    
    // Move up to parent window
    // Check if we've reached the top (window.parent === window at the top)
    if (currentWindow.parent && currentWindow.parent !== currentWindow) {
      debugLog('  ⬆️ Moving to parent window...');
      currentWindow = currentWindow.parent;
    } else {
      // No more parents, break out of this loop
      debugLog('  🛑 Reached top of parent chain');
      break;
    }
  }
  
  // STRATEGY 2: Check opener (for popup windows)
  // Some LMS systems open content in a popup instead of an iframe
  if (startWindow.opener && startWindow.opener !== startWindow) {
    debugLog('🔍 Checking opener window...');
    
    // Reset for opener search
    currentWindow = startWindow.opener;
    huntDepth = 0;
    
    // Search up the opener's parent chain too
    while (currentWindow && huntDepth < MAX_HUNT_DEPTH) {
      huntDepth++;
      
      if (currentWindow.API) {
        debugLog('  ✅ Found SCORM 1.2 API in opener chain!');
        return currentWindow.API;
      }
      
      if (currentWindow.API_1484_11) {
        debugLog('  ✅ Found SCORM 2004 API in opener chain!');
        return currentWindow.API_1484_11;
      }
      
      if (currentWindow.parent && currentWindow.parent !== currentWindow) {
        currentWindow = currentWindow.parent;
      } else {
        break;
      }
    }
  }
  
  debugLog('❌ API Hunt complete - no SCORM API found');
  return null;
}

/* ===========================================================================
 * SCORM INITIALIZATION & TERMINATION
 * =========================================================================== */

/**
 * INITIALIZE SCORM SESSION
 * ========================
 * Call this when the course first loads.
 * 
 * What it does:
 *   1. Runs the API Hunt to find the SCORM API
 *   2. Calls LMSInitialize() to start the session
 *   3. Sets initial lesson status to "incomplete"
 * 
 * @returns {Object} - {success: boolean, message: string}
 */
function initializeSCORM() {
  debugLog('🚀 Initializing SCORM...');
  
  // Don't initialize twice
  if (isInitialized) {
    debugLog('⚠️ Already initialized, skipping');
    return { success: true, message: 'Already initialized' };
  }
  
  // Run the API Hunt
  scormAPI = findSCORMAPI(window);
  
  if (!scormAPI) {
    // API not found - this happens when testing outside an LMS
    // We'll still let the content work, just without tracking
    return {
      success: false,
      message: 'SCORM API not found. Content will work but progress won\'t be tracked. (This is normal if testing outside an LMS.)'
    };
  }
  
  try {
    // Call LMSInitialize to start the session
    // The empty string parameter is required by the SCORM spec (don't ask why!)
    const initResult = scormAPI.LMSInitialize('');
    
    if (initResult !== 'true' && initResult !== true) {
      // Initialization failed - get error details
      const errorCode = scormAPI.LMSGetLastError();
      const errorMsg = scormAPI.LMSGetErrorString(errorCode);
      
      return {
        success: false,
        message: `LMSInitialize failed: Error ${errorCode} - ${errorMsg}`
      };
    }
    
    debugLog('✅ LMSInitialize succeeded');
    isInitialized = true;
    
    // Set initial status to "incomplete"
    // This ensures the LMS shows the course as "in progress" rather than "not started"
    setLessonStatus('incomplete');
    
    // Commit the initial status
    scormAPI.LMSCommit('');
    
    return { success: true, message: 'SCORM initialized successfully' };
    
  } catch (error) {
    return {
      success: false,
      message: `SCORM initialization error: ${error.message}`
    };
  }
}

/**
 * TERMINATE SCORM SESSION
 * =======================
 * Call this when the course is closing (in beforeunload event).
 * 
 * What it does:
 *   1. Commits any unsaved data
 *   2. Calls LMSFinish() to properly end the session
 * 
 * IMPORTANT:
 * - Always call this when the course closes
 * - Some LMS systems won't save data if you don't call LMSFinish
 */
function terminateSCORM() {
  debugLog('👋 Terminating SCORM session...');
  
  if (!scormAPI || !isInitialized) {
    debugLog('⚠️ No active SCORM session to terminate');
    return;
  }
  
  try {
    // Commit any pending data first
    scormAPI.LMSCommit('');
    debugLog('  ✅ Final commit done');
    
    // End the session
    const finishResult = scormAPI.LMSFinish('');
    
    if (finishResult === 'true' || finishResult === true) {
      debugLog('  ✅ LMSFinish succeeded');
    } else {
      const errorCode = scormAPI.LMSGetLastError();
      debugLog(`  ⚠️ LMSFinish returned ${finishResult}, error: ${errorCode}`);
    }
    
  } catch (error) {
    console.error('SCORM termination error:', error);
  }
  
  isInitialized = false;
}

/* ===========================================================================
 * SETTING SCORM DATA
 * =========================================================================== */

/**
 * SET LESSON STATUS
 * =================
 * Sets the cmi.core.lesson_status value in the LMS.
 * 
 * Valid values for SCORM 1.2:
 *   - "passed"     - Learner passed (met mastery score)
 *   - "failed"     - Learner failed (below mastery score)
 *   - "completed"  - Learner completed (no score involved)
 *   - "incomplete" - Learner started but not finished
 *   - "browsed"    - Learner just looked at it (rarely used)
 *   - "not attempted" - Initial state (set by LMS)
 * 
 * For this demo, we only use "incomplete" and "completed".
 * 
 * @param {string} status - The status to set
 * @returns {boolean} - True if successful
 */
function setLessonStatus(status) {
  if (!scormAPI || !isInitialized) {
    debugLog(`⚠️ Cannot set status "${status}" - SCORM not initialized`);
    return false;
  }
  
  debugLog(`📝 Setting lesson status to: ${status}`);
  
  try {
    // Use LMSSetValue to set the data element
    const result = scormAPI.LMSSetValue('cmi.core.lesson_status', status);
    
    if (result === 'true' || result === true) {
      debugLog('  ✅ Status set successfully');
      
      // Commit the change immediately to ensure it's saved
      scormAPI.LMSCommit('');
      debugLog('  ✅ Data committed');
      
      return true;
    } else {
      const errorCode = scormAPI.LMSGetLastError();
      const errorMsg = scormAPI.LMSGetErrorString(errorCode);
      debugLog(`  ❌ Failed to set status: Error ${errorCode} - ${errorMsg}`);
      return false;
    }
    
  } catch (error) {
    console.error('Error setting lesson status:', error);
    return false;
  }
}

/**
 * MARK COURSE AS COMPLETE
 * =======================
 * This is what gets called when the external content signals completion.
 * 
 * We track isCompleted to prevent sending completion multiple times
 * (some LMS systems get confused if you set "completed" repeatedly).
 */
function markComplete() {
  if (isCompleted) {
    debugLog('⚠️ Course already marked as complete');
    return true;
  }
  
  debugLog('🎉 Marking course as COMPLETE!');
  
  const success = setLessonStatus('completed');
  
  if (success) {
    isCompleted = true;
    debugLog('✅ Course completion recorded successfully');
  }
  
  return success;
}

/* ===========================================================================
 * POSTMESSAGE LISTENER - BRIDGE TO EXTERNAL CONTENT
 * =========================================================================== */

/**
 * SETUP MESSAGE LISTENER
 * ======================
 * This is the critical piece that connects the external content (in the iframe)
 * to our SCORM wrapper.
 * 
 * The external content can't access the SCORM API directly (cross-domain),
 * so it sends a postMessage to us, and we relay it to the LMS.
 * 
 * MESSAGE FORMAT (that we expect from the iframe):
 * {
 *   type: 'SCORM_COMMAND',       // Identifies this as a SCORM message
 *   command: 'setCompletion',    // What action to take
 *   data: {                      // Any associated data
 *     status: 'completed'
 *   }
 * }
 */
function setupMessageListener() {
  debugLog('📡 Setting up postMessage listener...');
  
  window.addEventListener('message', function(event) {
    // ⚠️ SECURITY CHECK: Validate the origin
    // This is CRITICAL - don't skip this check!
    if (!isOriginAllowed(event.origin)) {
      debugLog(`🚫 Blocked message from untrusted origin: ${event.origin}`);
      return; // Ignore messages from untrusted sources
    }
    
    debugLog(`📨 Received message from: ${event.origin}`);
    debugLog('   Message data:', event.data);
    
    // Check if this is a SCORM command
    if (!event.data || event.data.type !== 'SCORM_COMMAND') {
      debugLog('   ℹ️ Not a SCORM command, ignoring');
      return;
    }
    
    // Handle the command
    handleSCORMCommand(event.data, event.source);
  });
  
  debugLog('✅ Message listener active');
}

/**
 * CHECK IF ORIGIN IS ALLOWED
 * ==========================
 * Validates that a message came from a trusted source.
 * 
 * @param {string} origin - The origin to check (e.g., 'https://example.github.io')
 * @returns {boolean} - True if the origin is in our allowed list
 */
function isOriginAllowed(origin) {
  // Check against our whitelist
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    // Handle both exact matches and wildcard subdomains
    if (allowed === origin) return true;
    
    // For localhost, also handle port variations
    if (allowed.includes('localhost') || allowed.includes('127.0.0.1')) {
      const allowedBase = allowed.replace(/:\d+$/, ''); // Remove port
      const originBase = origin.replace(/:\d+$/, '');
      if (allowedBase === originBase) return true;
    }
    
    return false;
  });
  
  return isAllowed;
}

/**
 * HANDLE SCORM COMMAND
 * ====================
 * Processes commands received from the external content.
 * 
 * Currently supported commands:
 *   - 'setCompletion' - Mark the course as complete
 * 
 * You could extend this to support:
 *   - 'setScore' - Set a score value
 *   - 'setSuspendData' - Save bookmark data
 *   - 'getStatus' - Return current status to iframe
 * 
 * @param {Object} message - The message data
 * @param {Window} source - The window that sent the message (for replies)
 */
function handleSCORMCommand(message, source) {
  const { command, data } = message;
  
  debugLog(`🎮 Processing command: ${command}`);
  
  switch (command) {
    case 'setCompletion':
      // The external content is saying "mark me complete!"
      const success = markComplete();
      
      // Send acknowledgment back to the iframe
      sendAcknowledgment(source, {
        command: 'setCompletion',
        success: success,
        message: success ? 'Completion recorded' : 'Failed to record completion'
      });
      break;
      
    case 'ping':
      // Heartbeat check - iframe checking if we're listening
      debugLog('   Received ping, sending pong...');
      sendAcknowledgment(source, {
        command: 'ping',
        success: true,
        message: 'pong',
        scormAvailable: !!scormAPI
      });
      break;
      
    default:
      debugLog(`   ⚠️ Unknown command: ${command}`);
      sendAcknowledgment(source, {
        command: command,
        success: false,
        message: `Unknown command: ${command}`
      });
  }
}

/**
 * SEND ACKNOWLEDGMENT
 * ===================
 * Sends a response back to the iframe confirming we received and processed
 * their message.
 * 
 * This is important because postMessage is "fire and forget" - the sender
 * doesn't automatically know if the message was received.
 * 
 * @param {Window} targetWindow - The window to send to (event.source)
 * @param {Object} response - The response data
 */
function sendAcknowledgment(targetWindow, response) {
  if (!targetWindow) {
    debugLog('⚠️ Cannot send acknowledgment - no target window');
    return;
  }
  
  const ackMessage = {
    type: 'SCORM_ACK',  // Identifies this as an acknowledgment
    ...response
  };
  
  debugLog('📤 Sending acknowledgment:', ackMessage);
  
  // ⚠️ SECURITY: We could use a specific origin here instead of '*'
  // For now, using '*' because we don't know the exact iframe origin
  // In production, you might want to track and use the actual origin
  targetWindow.postMessage(ackMessage, '*');
}

/* ===========================================================================
 * UTILITY FUNCTIONS
 * =========================================================================== */

/**
 * DEBUG LOGGING
 * =============
 * Conditional logging that only outputs when DEBUG_MODE is true.
 * Makes it easy to silence logs in production.
 * 
 * @param {...any} args - Arguments to pass to console.log
 */
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log('[SCORM Proxy]', ...args);
  }
}

/* ===========================================================================
 * EXPLANATION: WHY THIS ARCHITECTURE?
 * =========================================================================== */

/**
 * QUESTION: Why not just put the SCORM JavaScript in the external content?
 * 
 * ANSWER: Same-Origin Policy prevents it!
 * 
 * The SCORM API lives in the LMS's window (let's say lms.company.com).
 * Your external content lives on your-site.com.
 * 
 * If your external content tries to do:
 *   window.parent.API.LMSSetValue('cmi.core.lesson_status', 'completed')
 * 
 * The browser will BLOCK it because it's a cross-origin access.
 * You'll get an error like: "Blocked a frame from accessing a cross-origin frame"
 * 
 * THE SOLUTION:
 * We put a thin "wrapper" page IN the SCORM package (launch.html + this script).
 * This wrapper:
 *   - Lives in the SAME origin as the LMS (when it's uploaded as a SCORM package)
 *   - CAN access the SCORM API directly
 *   - Loads your external content in an iframe
 *   - Listens for postMessage from the iframe (postMessage DOES work cross-origin)
 *   - Relays commands to the SCORM API
 * 
 * Essentially, we're creating a secure "bridge" between your content and the LMS.
 */

console.log('[SCORM Proxy] Script loaded. Waiting for initialization...');
