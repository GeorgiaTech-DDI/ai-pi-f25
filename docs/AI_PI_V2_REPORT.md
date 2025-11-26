# AI PI 2.0 System Enhancements: Onboarding and Summary Report

**Prepared For:** Future AI PI Research Team Members  
**Source Material:** "Enhancement and Implementation of the AI Assistant for the Georgia Tech Invention Studio"

---

## 1. Context and Problem Statement

The AI Prototyping Instructor (AI PI) system is a Retrieval-Augmented Generation (RAG) conversational assistant for the Georgia Tech Invention Studio. While AI PI V1 established feasibility, its monolithic architecture and ad-hoc maintenance proved insufficient to address three critical production-level challenges:

| V1 Anticipated Challenge | V2 Enhancement Solution |
|--------------------------|------------------------|
| Safety-Critical Information | Enhanced Safety Guardrail |
| Knowledge Base Maintenance | Human-in-the-Loop (HITL) Admin Dashboard |
| User Trust and Adoption | Deep Analytics Dashboard |

---

## 2. Refined Modular System Architecture

The V2 system replaces the monolithic V1 architecture with a decoupled, service-oriented design to improve scalability, security, and maintainability. This modularity was a foundational prerequisite for integrating new administrative and analytical services.

| Component | Function | V2 Status |
|-----------|----------|-----------|
| **Chat Application** | User-facing Next.js UI for interaction. | V1 UI, but now decoupled. |
| **Core RAG API** | Central orchestrator that runs the RAG pipeline and logs all interaction data (including a new 'RAG-state' tag) to the Interaction Log DB. | Core New Service. |
| **Admin Service** | Separate authenticated web app for Prototyping Instructors (PIs) to manage the knowledge base (Pinecone vector database). Features Azure OAuth authentication, file upload/management interface, and direct Pinecone integration. | **Implemented** (Full-stack development including auth, UI, and backend integration) |
| **Analytics Service** | Non-real-time backend that runs continuous evaluation (LLM-as-a-judge) on the logged data and populates the dashboard. | New V2 Microservice. |

---

## 3. Key Enhancements and Operational Outcomes

### 3.1. Human-in-the-Loop (HITL) Admin Dashboard 🛠️

**Goal:** Solves the Knowledge Base Maintenance challenge.

**Design:** Follows Human-Computer Interaction (HCI) principles to empower non-technical domain experts (PIs).

**Operation:** Abstracts vector database complexity by using a familiar "File Management" paradigm (Upload, View, Delete Document). It processes files via RecursiveCharacterSplitting and Pinecone upsert upon upload.

**Implementation Details:**

**Authentication & Security Infrastructure:**
- Researched and evaluated multiple authentication providers (Firebase → Azure OAuth)
- Implemented Azure OAuth 2.0 integration with Microsoft Entra ID (formerly Azure AD) for secure PI access
- Created comprehensive documentation for Azure OAuth setup and configuration (`AZURE_OAUTH_SETUP.md`)
- Established role-based access control ensuring only authorized PIs can modify the knowledge base

**Frontend Development:**
- Built the admin login interface and authentication flow
- Developed the file management UI following HCI principles for non-technical users
- Created intuitive upload/view/delete document interfaces
- Designed user experience to minimize learning curve for domain experts

**Backend Integration:**
- Designed and implemented API endpoints for admin operations (`/api/files.ts`, `/api/upload.ts`)
- Integrated Pinecone vector database backend with the admin dashboard
- Enabled document processing pipeline (RecursiveCharacterSplitting → Pinecone upsert)
- Cleaned and refactored codebase for production deployment

**Documentation & Deployment:**
- Authored extensive technical documentation for authentication setup and admin features
- Prepared the system for Vercel deployment with proper API access configuration
- Created README updates for future maintainers
- Documented troubleshooting guides for common implementation challenges

**Impact:** Reduced the time-to-production for new knowledge from days (V1, developer-dependent) to minutes (V2, self-serve). PIs independently added and updated 15 documents in a 4-week trial.

---

### 3.2. Deep Analytics Dashboard 📊

**Goal:** Addresses User Trust and Adoption by providing quantitative proof of reliability.

**Operation:** Automated, continuous evaluation framework that scores interactions using an "LLM-as-a-judge" framework.

**Core RAG Triad Metrics:**

- **Faithfulness:** Measures if the answer is factually grounded in the retrieved context (hallucination check).
- **Contextual Relevance:** Measures the performance of the retrieval step.
- **Answer Relevancy:** Measures if the final answer addresses the user's query.

**Impact:** Demonstrated a measurable increase in RAG quality, with the average Faithfulness score increasing from 0.72 to 0.89 following HITL curation.

---

### 3.3. Enhanced Safety Guardrail 🛡️

**Goal:** Mitigates the high risk of the V1 "silent failure" of RAG, solving the Safety-Critical Information challenge.

**Mechanism:** The Core RAG API tags responses based on retrieval outcome:

- **State 1: RAG-Grounded** — Context found (e.g., score > 0.75). UI displays the answer and references.
- **State 2: General Knowledge (Fallback)** — No context found. System queries the LLM without context (parametric-only).

**Warning System:** For State 2, the UI intercepts the general answer and renders an explicit warning that the information is unverified for the Invention Studio.

**Impact:** The warning was triggered on around ~20% of queries, demonstrating the frequency of RAG retrieval failure. Transparently admitting this limitation resulted in a higher user helpfulness rating (3.8/5) than system failures in V1 (1.0/5), building user trust through transparency.

---

### 3.4. Authentication Architecture Evolution 🔐

During development, the authentication system underwent strategic migration to optimize for institutional integration:

**Phases:**
- **Initial Phase (Firebase):** Rapid prototyping with Firebase Authentication to validate login flows and admin access patterns. Enabled quick iteration on admin dashboard functionality while learning authentication concepts.
- **Production Migration (Azure OAuth):** Transitioned to Azure OAuth 2.0 to leverage Georgia Tech's existing Microsoft ecosystem, enabling seamless SSO integration with institutional credentials.

**Challenge:** Steep learning curve with enterprise OAuth flows and Azure documentation. Initial unfamiliarity with authentication mechanisms required extensive research and experimentation.

**Solution:** Created comprehensive step-by-step documentation (`AZURE_OAUTH_SETUP.md`) to reduce onboarding friction for future developers. Documented common pitfalls and debugging strategies encountered during implementation.

**Impact:** Authentication migration enabled direct integration with Georgia Tech's institutional identity provider, eliminating the need for separate credential management and improving security posture. The documentation has become a key onboarding resource for new team members.

---

## 4. Future Work Directions

### Near-Term Enhancements

- **Deeper Analytics Loop:** Automatically route "Knowledge Gap" queries (low Contextual Relevance scores) from the Analytics Dashboard to the Admin Dashboard as a suggested worklist for PIs.

- **Improved UI:** Improve the UI to match the Georgia Tech branding and make it easier with instructions for users on using the tool. Add contextual help and tooltips for first-time users.

- **Enhanced Admin Features:** 
  - Expand admin dashboard with document versioning capabilities
  - Add batch upload functionality for efficient knowledge base updates
  - Implement usage analytics for uploaded documents to track which content is most valuable
  - Create document preview and search capabilities

- **Authentication Refinements:** 
  - Implement granular role-based permissions (e.g., read-only vs. full admin access)
  - Add audit logging for all admin actions to track knowledge base changes
  - Enable multi-factor authentication for enhanced security

### Long-Term Vision

- **Additional Dashboard Features:** Integrate real-time monitoring of system health, user satisfaction metrics, and content coverage analysis to provide actionable insights for continuous improvement.

- **Automated Knowledge Base Curation:** Develop ML-powered suggestions for content updates based on query patterns and knowledge gaps identified through analytics.

- **Cross-Platform Integration:** Extend the admin dashboard to support multiple knowledge domains beyond the Invention Studio, creating a reusable framework for institutional RAG systems.

---

## 5. Development Timeline and Key Milestones

**Week 1-2:** Research phase and subteam formation
- Reviewed past AI PI projects and identified improvement areas
- Evaluated cloud services (AWS, Firebase, Azure) for backend infrastructure
- Established meeting schedules and project timeline

**Week 3-4:** Authentication prototype (Firebase)
- Researched and implemented initial backend login logic
- Created HTML login interface for admin dashboard
- Updated documentation with implementation notes

**Week 5-6:** Migration to Azure OAuth
- Transitioned authentication from Firebase to Azure OAuth 2.0
- Conducted extensive research on Azure authentication documentation
- Completed Azure OAuth setup with comprehensive documentation

**Week 7-8:** Pinecone integration preparation
- Prepared admin dashboard architecture for backend integration
- Reviewed Pinecone API documentation and vector database concepts
- Designed API endpoints for file management operations

**Week 9-10:** Full-stack integration
- Integrated admin dashboard with Pinecone backend
- Implemented file upload, view, and delete functionality
- Cleaned and refactored codebase for production readiness

**Week 11-12:** Deployment and demonstration
- Configured Vercel deployment with API access
- Sprint to finalize project demo
- Prepared system for live demonstration

**Week 13-14:** Documentation and knowledge transfer
- Formatted research paper and technical documentation
- Created onboarding materials for future developers
- Compiled implementation summary and lessons learned

---

## 6. Technical Stack

- **Frontend:** Next.js, React, TypeScript
- **Authentication:** Azure OAuth 2.0 (Microsoft Entra ID)
- **Vector Database:** Pinecone
- **Deployment:** Vercel
- **Backend:** Node.js API Routes
- **Documentation Processing:** LangChain (RecursiveCharacterSplitting)

---

## 7. Conclusion

The AI PI 2.0 system represents a significant advancement in making RAG-based conversational assistants production-ready for safety-critical educational environments. The modular architecture, coupled with the HITL admin dashboard and deep analytics, addresses the key challenges of V1 while establishing a foundation for continuous improvement. The comprehensive documentation and onboarding materials ensure that future team members can build upon this work effectively.

**Key Takeaway:** The combination of technical excellence and thoughtful user experience design—empowering domain experts through intuitive interfaces while maintaining robust security and observability—is essential for deploying AI systems that users can trust and rely upon.
