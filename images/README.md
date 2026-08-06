# Screenshot drop-in contract

The homepage upgrades automatically (next deploy) when these files exist.
Portrait iPhone captures, 6.7" App Store size (1290×2796) or same ratio.
Light mode preferred (frames sit on navy/vellum grounds).

| File | Content |
|---|---|
| hero-today.jpg | Today screen |
| shot-invoice.jpg | Invoice with payment link |
| shot-pricing.jpg | Pricing calculator |
| shot-chat.jpg | AI coach chat |

Filenames are case-sensitive on Cloudflare Pages. JPG (not HEIC — browsers
can't render it); iPhone HEIC exports get converted before committing.

## After dropping in new captures

The committed files are 640px-wide web-optimized derivatives, and each JPG has
a `.webp` sibling that browsers get preferentially (via `<picture>` in
index.html). **If you replace a JPG, regenerate both files from the full-size
capture or the stale `.webp` keeps being served:**

```
ffmpeg -y -i capture.jpg -vf scale=640:-2 -q:v 3 hero-today.jpg
ffmpeg -y -i capture.jpg -vf scale=640:-2 -c:v libwebp -quality 82 hero-today.webp
```
