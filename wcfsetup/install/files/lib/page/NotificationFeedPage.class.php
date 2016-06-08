<?php
namespace wcf\page;
use wcf\system\exception\IllegalLinkException;
use wcf\system\user\notification\UserNotificationHandler;
use wcf\system\WCF;

/**
 * Shows a list of own user notifications in feed.
 *
 * @author	Joshua Ruesweg
 * @copyright	2001-2016 WoltLab GmbH
 * @license	GNU Lesser General Public License <http://opensource.org/licenses/lgpl-license.php>
 * @package	com.woltlab.wcf
 * @subpackage	page
 * @category	Community Framework
 * @since       2.2
 */
class NotificationFeedPage extends AbstractFeedPage {
	/**
	 * @inheritDoc
	 */
	public function readParameters() {
		parent::readParameters();
		
		if (!WCF::getUser()->userID) {
			throw new IllegalLinkException(); 
		}
		
		$this->title = WCF::getLanguage()->get('wcf.user.menu.community.notification');
	}
	
	/**
	 * @inheritDoc
	 */
	public function readData() {
		parent::readData();
		
		$this->items = new \ArrayIterator();
		
		$notifications = UserNotificationHandler::getInstance()->getNotifications(20);
		
		foreach ($notifications['notifications'] as $notification) {
			$this->items->append($notification['event']);
		} 
	}
}
