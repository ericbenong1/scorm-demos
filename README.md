# SCORM Light Package Conversion - Proof of Concept Demos

> **Purpose**: These demos demonstrate the core concepts needed to convert existing web content into SCORM-compliant packages that can be tracked by any LMS (Learning Management System).

---

## 🎯 What Problem Are We Solving?

You have training content hosted on an external website (like a WordPress site, custom web app, or third-party platform). You want this content to:

1. **Launch from an LMS** (like ScormCloud, Moodle, or Cornerstone)
2. **Track completion** - so the LMS knows when a learner finished
3. **Work across domains** - the content lives on one server, the LMS on another

The challenge? **Cross-domain security restrictions** (called "Same-Origin Policy") prevent direct communication between different websites. We solve this using the **postMessage API** - a secure way for windows to talk across domains.

---

## 📁 Project Structure

```
scorm_demos/
├── demo1_scorm_light/           # The main SCORM wrapper solution
│   ├── scorm_package/           # → ZIP this folder, upload to LMS
│   │   ├── imsmanifest.xml      # SCORM manifest (tells LMS about the course)
│   │   ├── launch.html          # Entry point, creates iframe to external content
│   │   └── scorm_api_proxy.js   # Finds LMS API, relays messages from iframe
│   │
│   └── external_content/        # → Host on GitHub Pages (or any web server)
│       ├── index.html           # Your actual course content
│       ├── scorm_bridge.js      # Sends completion status via postMessage
│       └── styles.css           # Basic styling
│
├── demo2_postmessage/           # Standalone postMessage tutorial
│   ├── parent.html              # The "receiver" window
│   ├── child.html               # The "sender" window (loaded in iframe)
│   └── styles.css               # Shared styles
│
└── README.md                    # This file
```

---

## 🔑 Key Concepts Explained

### What is SCORM?

**SCORM** (Sharable Content Object Reference Model) is a set of technical standards for e-learning. Think of it as a "language" that lets courses talk to LMS systems.

**SCORM 1.2** (what we're using) requires:
- A **manifest file** (`imsmanifest.xml`) that describes the course
- A **JavaScript API** that the course calls to report progress
- Specific **data model elements** like `cmi.core.lesson_status`

### The "API Hunt" Pattern

When a SCORM course launches, it needs to find the LMS's JavaScript API. The problem? The API could be in:
- The **parent window** (if your content is in an iframe)
- The **opener window** (if your content opened in a popup)
- **Multiple levels deep** (nested iframes)

The "API Hunt" is a recursive search pattern that checks each window level until it finds the API object (called `API` for SCORM 1.2 or `API_1484_11` for SCORM 2004).

### postMessage - Cross-Domain Communication

**The Problem**: Browser security (Same-Origin Policy) prevents JavaScript on `site-a.com` from accessing JavaScript on `site-b.com`.

**The Solution**: `window.postMessage()` - a secure messaging system where:
1. The sender explicitly specifies the target origin
2. The receiver validates the message source
3. Both sides agree on a message format

---

## 🚀 Demo 1: SCORM Light Wrapper

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         LMS (ScormCloud)                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SCORM Package (launch.html)                 │    │
│  │                                                          │    │
│  │   1. Finds LMS API using "API Hunt"                     │    │
│  │   2. Calls LMSInitialize()                              │    │
│  │   3. Creates iframe to external content                  │    │
│  │   4. Listens for postMessage from iframe                │    │
│  │   5. Relays completion to LMS via API                   │    │
│  │                                                          │    │
│  │   ┌──────────────────────────────────────────────────┐  │    │
│  │   │    IFRAME (External Content on GitHub Pages)      │  │    │
│  │   │                                                    │  │    │
│  │   │    • Shows course content                         │  │    │
│  │   │    • "Mark Complete" button                       │  │    │
│  │   │    • Sends postMessage to parent                  │  │    │
│  │   │                                                    │  │    │
│  │   └──────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### What This Demo Tracks

✅ **Completion Status** (`cmi.core.lesson_status` = "completed")

❌ Not included in this demo (but possible):
- Score/grade tracking
- Time spent tracking
- Suspend data (bookmarking)
- Detailed interaction tracking

### Setup Instructions

#### Step 1: Host External Content

1. Create a GitHub repository (e.g., `scorm-demos`)
2. Upload the `demo1_scorm_light/external_content/` folder
3. Enable GitHub Pages (Settings → Pages → Deploy from main branch)
4. Note your URL: `https://YOUR_USERNAME.github.io/scorm-demos/demo1_scorm_light/external_content/`

#### Step 2: Configure the SCORM Package

1. Open `demo1_scorm_light/scorm_package/launch.html`
2. Replace `YOUR_GITHUB_USERNAME` with your actual username
3. ZIP the entire `scorm_package` folder (not the parent folder!)

#### Step 3: Upload to LMS

1. Go to [ScormCloud](https://cloud.scorm.com) (free account available)
2. Upload your ZIP file
3. Launch the course and test!

---

## 🔬 Demo 2: postMessage Deep Dive

A standalone demonstration of cross-domain communication patterns.

### Features Demonstrated

1. **Origin Validation** - Only accept messages from trusted sources
2. **Message Acknowledgment** - Confirm receipt of messages
3. **Structured Messages** - Use consistent message format
4. **beforeunload Handling** - Send data before window closes

### How to Test

1. Open `parent.html` in a browser
2. The child iframe loads automatically
3. Click buttons to see messages flow
4. Check browser console for detailed logs

---

## 📚 Learning Resources

- [SCORM 1.2 Run-Time Reference](https://scorm.com/scorm-explained/technical-scorm/run-time/)
- [MDN: postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [ScormCloud Documentation](https://cloud.scorm.com/docs/)

---

## ⚠️ Important Notes

1. **This is a proof-of-concept** - Production code would need error handling, retry logic, and more robust security.

2. **SCORM 1.2 vs 2004** - This demo uses SCORM 1.2 (simpler, more widely supported). SCORM 2004 has different API names.

3. **LMS Compatibility** - Different LMS systems may have quirks. Always test with your target LMS.

4. **HTTPS Required** - Modern browsers require HTTPS for cross-domain communication. GitHub Pages provides this automatically.

---

## 🤝 Questions?

This demo is part of a proposal for SCORM Light Package Conversion services. Each file contains extensive comments explaining the code - start by reading through the source files!
