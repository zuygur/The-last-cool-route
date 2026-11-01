// strings.js - Centralized text and localization structure (supports EN / TR)

const Strings = {
    currentLang: 'en',

    data: {
        en: {
            appName: "42°C: The Last Cool Route",
            day: "Day",
            ec: "EC",
            timeMachine: "Charges",
            speed: "Speed",
            era2016: "2016 (Past)",
            era2026: "2026 (Present)",
            close: "Close (Esc)",
            menu: "Menu",
            startGame: "Start Game",
            continue: "Continue",
            newGame: "New Game",
            resume: "Resume Game",
            welcomeTitle: "Welcome to Your City!",
            welcomeDesc: "Click on locations and characters to view details. Manage your Eco Credits and shape the future!",
            needs: "Needs",
            urgent: "Urgent",
            ok: "OK"
        },
        tr: {
            appName: "42°C: Son Serin Rota",
            day: "Gün",
            ec: "EC",
            timeMachine: "Şarj",
            speed: "Hız",
            era2016: "2016 (Geçmiş)",
            era2026: "2026 (Bugün)",
            close: "Kapat (Esc)",
            menu: "Menü",
            startGame: "Oyuna Başla",
            continue: "Devam Et",
            newGame: "Yeni Oyun",
            resume: "Oyuna Dön",
            welcomeTitle: "Şehrinize Hoş Geldiniz!",
            welcomeDesc: "Detayları görmek için noktalara ve karakterlere tıklayın. Eco Credits bütçenizi yönetin ve geleceği şekillendirin!",
            needs: "İhtiyaçlar",
            urgent: "Acil",
            ok: "İyi"
        }
    },

    get(key) {
        const langData = this.data[this.currentLang] || this.data.en;
        return langData[key] || this.data.en[key] || key;
    }
};
