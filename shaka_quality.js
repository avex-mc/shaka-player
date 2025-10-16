/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// resolution_selection.jsの代わりに使用

/**
 * @extends {shaka.ui.SettingsMenu}
 * @final
 * @export
 */
shaka.ui.QualitySelection = class extends shaka.ui.SettingsMenu {
    /**
     * @param {!HTMLElement} parent
     * @param {!shaka.ui.Controls} controls
     */
    constructor(parent, controls) {
        super(parent, controls);

        this.button.classList.add('shaka-resolution-button');
        this.button.classList.add('shaka-tooltip-status');
        this.menu.classList.add('shaka-resolutions');

        this.eventManager.listen(
            this.localization, shaka.ui.Localization.LOCALE_UPDATED, () => {
                this.updateLocalizedStrings_();
            });

        this.eventManager.listen(
            this.localization, shaka.ui.Localization.LOCALE_CHANGED, () => {
                this.updateLocalizedStrings_();
            });


        this.eventManager.listen(this.player, 'variantchanged', () => {
            this.updateResolutionSelection_();
        });

        this.eventManager.listen(this.player, 'trackschanged', () => {
            this.updateResolutionSelection_();
        });

        this.eventManager.listen(this.player, 'abrstatuschanged', () => {
            this.updateResolutionSelection_();
        });

        this.updateResolutionSelection_();
    }


    /** @private */
    updateResolutionSelection_() {
        /** @type {!Array.<shaka.extern.Track>} */
        let tracks = [];
        // When played with src=, the variant tracks available from
        // player.getVariantTracks() represent languages, not resolutions.
        if (this.player.getLoadMode() != shaka.Player.LoadMode.SRC_EQUALS) {
            tracks = this.player.getVariantTracks();
        }

        // If there is a selected variant track, then we filter out any tracks in
        // a different language.  Then we use those remaining tracks to display the
        // available resolutions.
        const selectedTrack = tracks.find((track) => track.active);
        if (selectedTrack) {
            // Filter by current audio language.
            tracks = tracks.filter((track) => {
                if (track.language != selectedTrack.language) {
                    return false;
                }
                if (this.controls.getConfig().showAudioChannelCountVariants &&
                    track.channelsCount && selectedTrack.channelsCount &&
                    track.channelsCount != selectedTrack.channelsCount) {
                    return false;
                }
                return true;
            });
        }

        // Remove duplicate entries with the same resolution.
        tracks = tracks.filter((track, idx) => {
            return tracks.findIndex((t) =>
                t.height == track.height &&
                t.bandwidth == track.bandwidth,
            ) == idx;
        });

        // Sort the tracks by bandwidth.
        tracks.sort((t1, t2) => t2.bandwidth - t1.bandwidth);

        // Remove old shaka-resolutions
        // 1. Save the back to menu button
        const backButton = this.menu.querySelector('.shaka-back-to-overflow-button');

        // 2. Remove everything
        while (this.menu.firstChild)
            this.menu.removeChild(this.menu.firstChild);

        // 3. Add the backTo Menu button back
        this.menu.appendChild(backButton);

        const abrEnabled = this.player.getConfiguration().abr.enabled;

        // Add new ones
        for (const track of tracks) {
            if (multiangleType && track.displayName == '360p') {
                continue;
            }
            const button = document.createElement('button');
            button.setAttribute('type', 'button');
            button.classList.add('explicit-resolution');
            this.eventManager.listen(button, 'click', () => {
                this.onTrackSelected_(track);
                this.menu.classList.add('shaka-hidden');
            });

            const span = document.createElement('span');
            if (track.displayName) {
                const textOverride = {
                    '2160p60': 'Very High 60FPS',
                    '1080p60': 'High 60FPS',
                    '720p60': 'Middle 60FPS',
                    '480p60': 'Low 60FPS',
                    '2160p': 'Very High',
                    '1080p': 'High',
                    '720p': 'Middle',
                    '480p': 'Low',
                }[track.displayName];
                span.textContent = multiangleType
                    ? textOverride || track.displayName
                    : track.displayName;
            } else if (this.player.isAudioOnly() && track.bandwidth) {
                span.textContent = Math.round(track.bandwidth / 1000) + ' kbits/s';
            } else if (track.height && track.width) {
                span.textContent = this.getResolutionLabel_(track);
            } else {
                span.textContent = 'Unknown';
            }
            button.appendChild(span);

            if (!abrEnabled && track == selectedTrack) {
                // If abr is disabled, mark the selected track's resolution.
                button.ariaSelected = 'true';
                span.classList.add('shaka-chosen-item');
                this.currentSelection.textContent = span.textContent;
            }
            this.menu.appendChild(button);
        }

        // Add the Auto button
        const autoButton = document.createElement('button');
        autoButton.setAttribute('type', 'button');
        autoButton.classList.add('shaka-enable-abr-button');
        this.eventManager.listen(autoButton, 'click', () => {
            const config = { abr: { enabled: true } };
            this.player.configure(config);
            this.updateResolutionSelection_();
            this.menu.classList.add('shaka-hidden');
        });

        /** @private {!HTMLElement}*/
        this.abrOnSpan_ = document.createElement('span');
        this.abrOnSpan_.classList.add('shaka-auto-span');
        this.abrOnSpan_.textContent = this.localization.resolve('QUALITY_AUTO');
        autoButton.appendChild(this.abrOnSpan_);

        // If abr is enabled reflect it by marking 'Auto' as selected.
        if (abrEnabled) {
            autoButton.ariaSelected = 'true';

            this.abrOnSpan_.classList.add('shaka-chosen-item');

            this.currentSelection.textContent =
                this.localization.resolve('auto');
        }

        this.button.setAttribute('shaka-status', this.currentSelection.textContent);

        this.menu.appendChild(autoButton);
        this.menu.querySelector('.shaka-chosen-item').parentElement.focus();
        this.controls.dispatchEvent(
            new shaka.util.FakeEvent('resolutionselectionupdated'));

        this.updateLocalizedStrings_();

        this.button.classList[tracks.length > 0 ? 'remove' : 'add']('shaka-hidden');
    }


    /**
     * @param {!shaka.extern.Track} track
     * @return {string}
     * @private
     */
    getResolutionLabel_(track) {
        const trackHeight = track.height || 0;
        const trackWidth = track.width || 0;
        let height = trackHeight;
        const aspectRatio = trackWidth / trackHeight;
        if (aspectRatio > (16 / 9)) {
            height = Math.round(trackWidth * 9 / 16);
        }
        let text = height + 'p';
        if (height == 2160) {
            text = '4K';
        }
        const frameRate = track.frameRate;
        if (frameRate && (frameRate >= 50 || frameRate <= 20)) {
            text += Math.round(track.frameRate);
        }
        if (track.hdr == 'PQ' || track.hdr == 'HLG') {
            text += ' (HDR)';
        }
        if (track.videoLayout == 'CH-STEREO') {
            text += ' (3D)';
        }
        return text;
    }


    /**
     * @param {!shaka.extern.Track} track
     * @private
     */
    onTrackSelected_(track) {
        // Disable abr manager before changing tracks.
        const config = { abr: { enabled: false } };
        this.player.configure(config);
        const clearBuffer = this.controls.getConfig().clearBufferOnQualityChange;
        this.player.selectVariantTrack(track, clearBuffer);
    }


    /**
     * @private
     */
    updateLocalizedStrings_() {
        this.button.ariaLabel = this.localization.resolve('RESOLUTION');
        this.backButton.ariaLabel = this.localization.resolve('RESOLUTION');
        this.backSpan.textContent = this.localization.resolve('RESOLUTION');
        this.nameSpan.textContent = this.localization.resolve('RESOLUTION');
        this.abrOnSpan_.textContent = this.localization.resolve('AUTO_QUALITY');

        if (this.player.getConfiguration().abr.enabled) {
            this.currentSelection.textContent = this.localization.resolve('AUTO_QUALITY');
        }
    }
};


/**
 * @implements {shaka.extern.IUIElement.Factory}
 * @final
 */
shaka.ui.QualitySelection.Factory = class {
    /** @override */
    create(rootElement, controls) {
        return new shaka.ui.QualitySelection(rootElement, controls);
    }
};

shaka.ui.OverflowMenu.registerElement(
    'quality2', new shaka.ui.QualitySelection.Factory());

shaka.ui.Controls.registerElement(
    'quality2', new shaka.ui.QualitySelection.Factory());

