# 🌐 Website Cloner

A simple **Website Cloner** built with Node.js that allows you to scrape and save any website (HTML, CSS, JS, images, and other assets) locally. This tool is useful for offline reference, learning from website structures, or quickly duplicating layouts for experimentation.

---
<img width="1920" height="1080" alt="Screenshot (284)" src="https://github.com/user-attachments/assets/5ba63d50-4e5a-48e4-96a0-fa8f992bb0b8" />


## 🚀 Features

* Clone complete websites (HTML, CSS, JS, images, assets).
* Save files locally with original folder structure.
* Easy to run with Node.js.
* Beginner-friendly and customizable.

---

## 📦 Installation

1. Clone this repository

```bash
git clone https://github.com/Tejas-Dherange/Website-Cloner.git
cd Website-Cloner
```

2. Install dependencies

```bash
npm install
```

3. Add api keys in .env
```
OPENAI_API_KEY=sample api key
```
---

## ▶️ Usage

1. Run the script with a target website URL:

```bash
node index.js https://example.com
```

2. The cloned website will be saved inside a `clones/` folder (or the configured output directory).

---

## ⚙️ Configuration

* By default, it saves HTML, CSS, JS, and images.
* You can update the output path or filters in the code if needed.

---

## 📂 Project Structure

```
Website-Cloner/
│── index.js        # Main script
│── package.json    # Dependencies
│── package-lock.json    # Dependencies
│── piyush-clone/         # Cloned websites stored here
└── README.md       # Documentation
```

## 👨‍💻 Author

Created by [Tejas Dherange](https://github.com/Tejas-Dherange) 🚀
