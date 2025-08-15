/**
 * =================================================================
 * TypoLab Application Script (Client-Side)
 * - 이 스크립트는 Netlify Function과 통신하여 모든 UI 인터랙션을 처리합니다.
 * =================================================================
 */

// --- 1. 핵심 클래스 정의 ---

class ErrorHandler {
    static handle(error, context = '작업') {
        console.error(`[${context} 오류]`, error);
        alert(`${context} 중 오류 발생: ${error.message}`);
    }
}

// 💥 삭제됨: APIKeyManager 클래스는 더 이상 필요 없습니다.

class OpenAIService {
    // OpenAI에 직접 요청하는 대신, 우리가 만든 Netlify 함수를 호출하는 헬퍼 함수입니다.
    static async #callNetlifyFunction(prompt) {
        try {
            const response = await fetch('/.netlify/functions/getOpenAiResult', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt })
            });
            if (!response.ok) {
                throw new Error('Netlify 함수를 호출하는 데 실패했습니다.');
            }
            const data = await response.json();
            return data.result; // Netlify 함수로부터 받은 AI의 답변
        } catch (error) {
            ErrorHandler.handle(error, 'AI 서비스 통신');
            throw error;
        }
    }

    static async generateGuide(inputs) {
        // 프롬프트 생성 로직은 그대로 유지합니다.
        const prompt = `
            당신은 한국 시장을 잘 이해하는 시니어 UX/UI 디자이너입니다. 사용자가 입력한 아래 조건에 맞춰 웹 디자인 시스템을 한국어로 제안해주세요. 제안하는 모든 색상은 배경으로 사용될 때 흰색(#FFFFFF) 또는 검은색(#000000) 글씨와 함께 WCAG AA 등급 이상의 명도 대비를 만족해야 합니다.
            사용자 입력 조건:
            - 서비스 목적: ${inputs.purpose}
            - 대상 연령: ${inputs.age}
            - 핵심 키워드: ${inputs.keywords}
            - 원하는 분위기: ${inputs.mood}
            아래의 JSON 스키마를 완벽하게 준수하여 응답해야 합니다.
            {
              "fontSystem": { "category": "Sans-serif 또는 Serif", "headline": { "fontFamily": "Google Fonts 이름", "fontSize": "32px", "fontWeight": "700" }, "body": { "fontFamily": "Google Fonts 이름", "fontSize": "16px", "fontWeight": "400" }, "caption": { "fontFamily": "Google Fonts 이름", "fontSize": "12px", "fontWeight": "400" }, "guideline": "이 폰트 조합이 왜 해당 컨셉에 적합한지에 대한 1-2문장의 짧은 설명." },
              "colorSystem": [ { "hex": "#RRGGBB", "name": "메인 컬러 이름", "usage": "용도 설명." }, { "hex": "#RRGGBB", "name": "보조 컬러 이름", "usage": "용도 설명." } ],
              "grayscaleSystem": ["#212529", "#495057", "#868e96", "#ced4da", "#f8f9fa"]
            }
        `;
        // OpenAI에 직접 요청하는 대신, Netlify 함수를 호출합니다.
        const rawJsonResult = await this.#callNetlifyFunction(prompt);
        return JSON.parse(rawJsonResult); // 결과가 JSON 문자열이므로 객체로 변환합니다.
    }

    static async getChatReply(messages) {
        // 채팅 기록을 하나의 프롬프트로 만듭니다.
        const systemMessage = `당신은 경력 15년차의 UI/UX 디자인 팀장입니다. 사용자는 당신의 팀원인 주니어 디자이너입니다. 항상 다음 원칙에 따라 답변해주세요: 1. 말투: 전문가적이고 신뢰감 있지만, 팀원을 가르치듯 친절하고 상세하게 설명합니다. "음, 좋은 질문이네요.", "이 부분은 실무에서 자주 하는 실수인데..." 와 같은 어투를 사용하세요. 2. 내용: 단순히 답만 알려주지 말고, '왜' 그렇게 해야 하는지 디자인 원칙이나 사용자 경험(UX) 관점에서 근거를 제시합니다. 3. 실용성: 실제 웹 디자인 실무에서 바로 적용할 수 있는 구체적인 팁이나 대안을 함께 제안합니다. 4. 절대 마크다운(**, *, # 등)을 사용하지 말고, 순수 텍스트로만 답변합니다.`;
        const chatHistoryString = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const prompt = `${systemMessage}\n\n[대화 기록]\n${chatHistoryString}`;

        // OpenAI에 직접 요청하는 대신, Netlify 함수를 호출합니다.
        const reply = await this.#callNetlifyFunction(prompt);
        return reply.replace(/\*\*(.*?)\*\*/g, '$1');
    }
}

class TypographyAnalyzer {
    constructor() { this.wcagRules = { contrastRatio: 4.5, minFontSize: 16, minLineHeight: 1.5 }; }
    analyze(iframeDoc) {
        const elementsWithIssues = []; const uniqueFonts = new Set(); const uniqueColors = new Set();
        iframeDoc.querySelectorAll('h1, h2, h3, h4, p, a, li, span, div').forEach(el => {
            if (!el.textContent.trim() || el.offsetWidth === 0) return;
            const computedStyle = iframeDoc.defaultView.getComputedStyle(el);
            uniqueFonts.add(computedStyle.fontFamily); uniqueColors.add(computedStyle.color);
            const analysis = { domElement: el, issues: [] };
            this.checkCompliance(analysis, computedStyle);
            if (analysis.issues.length > 0) elementsWithIssues.push(analysis);
        });
        return { elements: elementsWithIssues, consistency: { fontCount: uniqueFonts.size, colorCount: uniqueColors.size } };
    }
    checkCompliance(analysis, style) {
        const fontSize = parseFloat(style.fontSize);
        if (fontSize < this.wcagRules.minFontSize) analysis.issues.push({ type: 'fontSize', message: `권장 크기(${this.wcagRules.minFontSize}px)보다 작습니다.` });
        const contrast = this.getContrast(style.color, this.getRealBackgroundColor(analysis.domElement, analysis.domElement.ownerDocument.defaultView));
        if (contrast < this.wcagRules.contrastRatio) analysis.issues.push({ type: 'contrast', message: `명도 대비가 WCAG AA 기준(${this.wcagRules.contrastRatio}:1)에 미달합니다.` });
        const lineHeight = parseFloat(style.lineHeight);
        if (!isNaN(lineHeight) && (lineHeight / fontSize) < this.wcagRules.minLineHeight) analysis.issues.push({ type: 'lineHeight', message: `줄 간격이 권장 비율(${this.wcagRules.minLineHeight})보다 좁습니다.` });
    }
    getRealBackgroundColor = (element, view) => { let current = element; while (current) { const bgColor = view.getComputedStyle(current).backgroundColor; if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') return bgColor; if (current.tagName.toLowerCase() === 'body') break; current = current.parentElement; } return 'rgb(255, 255, 255)'; }
    getLuminance(color) { const rgb = this.parseColor(color); const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722; }
    getContrast(color1, color2) { const lum1 = this.getLuminance(color1); const lum2 = this.getLuminance(color2); return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05); }
    parseColor(colorStr) { const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0]; }
    getWCAGRating(contrast) { if (contrast >= 7) return 'AAA'; if (contrast >= 4.5) return 'AA'; return 'Fail'; }
    rgbToHex(rgbStr) { const [r, g, b] = this.parseColor(rgbStr); return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(); }
}

class TypoLab {
    constructor() {
        this.cacheDOMElements();
        this.analyzer = new TypographyAnalyzer();
        this.chatHistory = [];
        this.initializeEventListeners();
        // 💥 수정됨: APIKeyManager.init() 호출을 삭제했습니다.
    }
    cacheDOMElements() { this.dom = { tabBtns: document.querySelectorAll('.tab-btn'), pages: document.querySelectorAll('.tab-content'), generateGuideBtn: document.getElementById('generateGuideBtn'), guideResultSection: document.getElementById('guideResults'), ageRange: document.getElementById('ageRange'), ageDisplay: document.getElementById('ageDisplay'), fileInput: document.getElementById('fileInput'), uploadArea: document.getElementById('uploadArea'), statusIndicator: document.getElementById('statusIndicator'), statusText: document.getElementById('statusText'), analyzeBtn: document.getElementById('analyzeBtn'), analysisResults: document.getElementById('analysisResults'), chatMessages: document.getElementById('chatMessages'), chatInput: document.getElementById('chatInput'), sendChatBtn: document.getElementById('sendChatBtn'), loadingOverlay: document.getElementById('loadingOverlay'), loadingText: document.getElementById('loadingText'), }; }
    initializeEventListeners() {
        this.dom.tabBtns.forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
        this.dom.generateGuideBtn.addEventListener('click', () => this.generateGuide());
        this.dom.ageRange.addEventListener('input', e => this.updateAgeDisplay(e.target.value));
        this.dom.uploadArea.addEventListener('click', () => this.dom.fileInput.click());
        this.dom.fileInput.addEventListener('change', e => this.handleFile(e.target.files[0]));
        this.dom.uploadArea.addEventListener('dragover', e => { e.preventDefault(); this.dom.uploadArea.classList.add('dragover'); });
        this.dom.uploadArea.addEventListener('dragleave', () => this.dom.uploadArea.classList.remove('dragover'));
        this.dom.uploadArea.addEventListener('drop', e => { e.preventDefault(); this.dom.uploadArea.classList.remove('dragover'); this.handleFile(e.dataTransfer.files[0]); });
        this.dom.analyzeBtn.addEventListener('click', () => this.runAnalysis());
        this.dom.sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        this.dom.chatInput.addEventListener('keypress', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChatMessage(); } });
    }
    async generateGuide() {
        this.showLoading(true, 'AI가 디자인 시스템을 생성 중입니다...');
        try {
            const purpose = Array.from(document.querySelectorAll('input[name="purpose"]:checked')).map(el => el.value).join(', ');
            const mood = Array.from(document.querySelectorAll('input[name="mood"]:checked')).map(el => el.value).join(', ');
            if (!purpose || !mood) { ErrorHandler.handle(new Error("서비스 목적과 분위기를 하나 이상 선택해주세요."), "입력 오류"); return; }
            const inputs = { purpose, mood, age: this.dom.ageDisplay.textContent, keywords: document.getElementById('keywords').value };
            const result = await OpenAIService.generateGuide(inputs);
            this.displayGuideResults(result);
        } catch (error) { ErrorHandler.handle(error, 'AI 가이드 생성'); } finally { this.showLoading(false); }
    }
    displayGuideResults(result) {
        const { fontSystem, colorSystem } = result;
        this.dom.guideResultSection.classList.add('show');
        let html = `<div class="font-system-card"><div class="card-header"><i class="fas fa-font"></i> 폰트 시스템</div>${Object.entries(fontSystem).map(([key, value]) => { if (typeof value === 'object') return `<div class="font-item"><span class="font-item-label">${key}</span><span>${value.fontFamily}, ${value.fontSize}, ${value.fontWeight}</span></div>`; return ''; }).join('')}<p class="font-guideline">${fontSystem.guideline}</p></div><div class="color-system-card"><div class="card-header"><i class="fas fa-palette"></i> 색상 시스템</div>${colorSystem.map(color => this.createColorComboHTML(color)).join('')}</div>`;
        this.dom.guideResultSection.innerHTML = html;
    }
    createColorComboHTML(color) {
        const contrastWithWhite = this.analyzer.getContrast(color.hex, '#FFFFFF'); const contrastWithBlack = this.analyzer.getContrast(color.hex, '#000000');
        const bestTextColor = contrastWithWhite > contrastWithBlack ? '#FFFFFF' : '#000000'; const bestContrast = Math.max(contrastWithWhite, contrastWithBlack);
        const rating = this.analyzer.getWCAGRating(bestContrast);
        return `<div class="color-item"><div class="color-item-header"><div class="color-swatch-lg" style="background-color:${color.hex};"></div><div class="color-info"><h5>${color.name} (${color.hex})</h5><p>${color.usage}</p></div></div><div class="color-combinations"><div class="combo-card"><div class="combo-preview" style="background-color:${color.hex}; color:${bestTextColor};">Aa</div><div class="combo-details"><strong>${bestContrast.toFixed(2)}:1</strong> <span class="wcag-badge wcag-${rating.toLowerCase()}">${rating}</span></div></div></div></div>`;
    }
    updateAgeDisplay(value) { const age = parseInt(value); if(age < 20) this.dom.ageDisplay.textContent = "10대"; else if(age > 60) this.dom.ageDisplay.textContent = "60대 이상"; else this.dom.ageDisplay.textContent = `${Math.round(age/10)*10}대 중심`; }
    handleFile(file) { if (!file || !file.type.includes('html')) return ErrorHandler.handle(new Error('HTML 파일만 업로드 가능합니다.'), '파일 처리'); this.uploadedFile = file; this.dom.statusIndicator.classList.add('show'); this.dom.statusText.textContent = `준비 완료: ${file.name}`; this.dom.analyzeBtn.style.display = 'inline-flex'; this.dom.uploadArea.style.display = 'none'; }
    async runAnalysis() {
        if (!this.uploadedFile) return;
        this.dom.statusText.textContent = '분석 중...'; this.showLoading(true, 'HTML 파일을 분석 중입니다...');
        try {
            const htmlContent = await this.uploadedFile.text();
            const parser = new DOMParser(), doc = parser.parseFromString(htmlContent, 'text/html');
            const cssLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(link => link.outerHTML).join('');
            document.getElementById('previewFrame').srcdoc = cssLinks + doc.body.innerHTML;
            document.getElementById('previewFrame').onload = () => {
                const iframeDoc = document.getElementById('previewFrame').contentDocument;
                const analysisResult = this.analyzer.analyze(iframeDoc);
                this.displayFeedbackDashboard(analysisResult);
                this.dom.statusIndicator.style.display = 'none';
                this.dom.analysisResults.classList.add('show');
                this.showLoading(false);
            };
        } catch (error) { ErrorHandler.handle(error, '분석'); this.showLoading(false); }
    }
    displayFeedbackDashboard(result) {
        this.dom.analysisResults.innerHTML = `<div class="metric-card"><h4><i class="fas fa-font"></i> 일관성</h4><ul class="consistency-list"><li><span>사용된 폰트 종류</span> <strong>${result.consistency.fontCount}개</strong></li><li><span>사용된 글자 색상</span> <strong>${result.consistency.colorCount}개</strong></li></ul></div><div class="metric-card"><h4><i class="fas fa-ruler-vertical"></i> 줄 간격 (예시)</h4><div class="gauge-container"><div class="gauge-fill gauge-good" style="width: 80%;"></div></div></div><h4>개선 제안 (${result.elements.length}개)</h4>`;
    }
    async sendChatMessage() {
        const message = this.dom.chatInput.value.trim(); if (!message) return;
        this.addChatMessage('user', message); this.chatHistory.push({ role: 'user', content: message });
        this.dom.chatInput.value = ''; this.showLoading(true, 'AI 팀장님이 답변을 생각 중입니다...');
        try {
            const reply = await OpenAIService.getChatReply(this.chatHistory);
            this.chatHistory.push({ role: 'assistant', content: reply });
            this.typeMessage(reply);
        } catch (error) { ErrorHandler.handle(error, '챗봇'); } finally { this.showLoading(false); }
    }
    addChatMessage(role, text) { const msgDiv = document.createElement('div'); msgDiv.className = `message ${role}`; msgDiv.textContent = text; this.dom.chatMessages.appendChild(msgDiv); this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight; return msgDiv; }
    typeMessage(text) {
        const msgDiv = this.addChatMessage('ai', ''); msgDiv.classList.add('typing'); let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) { msgDiv.textContent += text.charAt(i); i++; this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight; }
            else { clearInterval(interval); msgDiv.classList.remove('typing'); }
        }, 25);
    }
    switchTab(tabId) { this.dom.pages.forEach(page => page.classList.remove('active')); this.dom.tabBtns.forEach(btn => btn.classList.remove('active')); document.getElementById(`${tabId}-page`).classList.add('active'); document.querySelector(`[data-tab="${tabId}"]`).classList.add('active'); }
    showLoading(show, text = '처리 중...') { this.dom.loadingText.textContent = text; this.dom.loadingOverlay.classList.toggle('show', show); }
}

document.addEventListener('DOMContentLoaded', () => { try { window.typoLabApp = new TypoLab(); } catch (error) { ErrorHandler.handle(error, "앱 시작"); } });

// 💥 삭제됨: 이전에 테스트용으로 추가했던 askMyWebsite 함수는 TypoLab 클래스에 통합되었으므로 필요 없습니다.