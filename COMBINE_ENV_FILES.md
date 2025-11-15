# How to Combine Your .env Files

## Quick Method

I've created a combined example file. To combine your existing files:

### Option 1: Use the Combined Example

```bash
# Copy the combined example
cp env.combined.example .env

# Then fill in your actual values
```

### Option 2: Manually Combine

1. **Copy all variables from root `.env`** to a new `.env` file
2. **Copy all variables from `backend/.env`** to the same `.env` file
3. **Remove duplicates** (keep the values you want)
4. **Save as `.env`** in the root directory

### Option 3: Use This Command

```bash
# Combine both files (keeps all unique variables)
cat .env backend/.env 2>/dev/null | grep -v "^#" | grep -v "^$" | sort -u > .env.combined

# Review the combined file
cat .env.combined

# If it looks good, replace your .env
mv .env.combined .env
```

## After Combining

1. **Delete `backend/.env`** (optional - the code will use root `.env` now)
2. **Test locally** - make sure everything still works
3. **For deployment** - set all variables in Render dashboard (same as before)

## What the Code Does Now

The backend will:
1. First try to load `backend/.env` (for backward compatibility)
2. If that doesn't exist, load root `.env`
3. In production, use platform environment variables

So you can use either:
- ✅ One `.env` file at root (simpler)
- ✅ Two separate files (if you prefer separation)

Both work!

