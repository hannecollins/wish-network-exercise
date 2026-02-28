# Wish Network Exercise

A web-based tool for collecting student network data and visualizing social ties in the classroom.

## Overview

This exercise helps students understand the difference between **close ties** (who they talk to) and **weak ties** (who can grant their wishes). The tool generates two network diagrams to illustrate this concept.

## How to Use in Class

### Before Class

1. **Open the tool**: Open `index.html` in a web browser (works best in Chrome, Firefox, or Safari)
2. **Enter student names**: 
   - Go to the "Setup" tab
   - Enter all student names in your section (one per line)
   - Click "Save Student List"

### During Class

#### Step 1: Setup (5 minutes)
- Have students open the tool on their devices (or use one shared device)
- Make sure all student names are entered

#### Step 2: Phase 1 - Make a Wish (10 minutes)
- Switch to the "Make a Wish" tab
- Each student should:
  1. Select their name from the dropdown
  2. Check the boxes for people they talk to most in the section
  3. Enter their wish (e.g., "I want to learn how to skateboard")
  4. Click "Submit My Wish"
- After submitting, the form clears for the next student
- **Important**: Wait until all students have submitted their wishes before moving to Phase 2

#### Step 3: Phase 2 - Grant Wishes (10 minutes)
- Switch to the "Grant Wishes" tab
- Students can now see all wishes from their classmates
- Each student should:
  1. Select their name from the dropdown
  2. Review all the wishes displayed
  3. Select 1-3 students whose wishes they can grant
  4. Click "Submit My Wish Grants"
- After submitting, the form clears for the next student

#### Step 4: View Networks (5 minutes)
- Switch to the "Network Diagrams" tab
- Click "Generate Network Diagrams"
- Two diagrams will appear:
  - **Close Ties Network**: Shows who talks to whom (bidirectional, undirected)
  - **Wish Ties Network**: Shows who grants wishes to whom (directed arrows)

### Discussion Points

- Compare the two networks: Are they different?
- Notice how people you're close to aren't necessarily the ones who can grant your wishes
- Discuss the importance of weak ties in accessing new information and opportunities
- Talk about network structure and how it affects information flow

## Features

- **Easy data collection**: Simple form interface for students
- **Real-time visualization**: Generate network diagrams instantly
- **Data persistence**: Data is saved in browser's localStorage
- **Export/Import**: Save data as JSON for later use or sharing
- **Interactive networks**: Students can drag nodes and zoom in/out

## Technical Details

- Pure HTML/CSS/JavaScript (no server required)
- Uses vis.js library for network visualization
- Data stored in browser localStorage
- Works offline after initial load

## Tips for Best Results

1. **Use a large screen or projector** for the network diagrams so the whole class can see
2. **Have students submit data one at a time** to avoid confusion
3. **Export the data** after class to keep a record
4. **Take screenshots** of the networks for your presentation slides

## Troubleshooting

- **Data not saving?** Make sure you're using a modern browser (Chrome, Firefox, Safari, Edge)
- **Networks not showing?** Make sure you have an internet connection (needed to load vis.js library)
- **Want to start over?** Use the "Clear All Data" button (be careful - this cannot be undone!)

## File Structure

- `index.html` - Main HTML file with the interface
- `app.js` - JavaScript code handling all functionality
- `README.md` - This file

## License

Free to use for educational purposes.