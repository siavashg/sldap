var http = require('https'),
    ldap = require('ldapjs');

var server = ldap.createServer(),
    port = process.env.PORT || 1389,
    contacts = {},
    updateInterval = process.env.SLDAP_UPDATE_INTERVAL || 30*60*1000,
    apiToken = process.env.SLDAP_SLACK_API_TOKEN || '',
    organizationName = process.env.SLDAP_ORGANIZATION || 'example',
    slack = {
        host: 'slack.com',
        path: '/api/users.list?token=' + apiToken
    };

if (apiToken.length === 0) {
    console.error('Missing Slack API Token, set env var SLDAP_SLACK_API_TOKEN');
    process.exit(1);
}

console.log('Organization name: ', organizationName);
console.log('Update interval seconds: ', updateInterval / 1000);
console.log('API token: ', Array(apiToken.length).join('*'));

var fetchContacts = function() {
    req = http.get(slack, function(res) {
        var output = '';
        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function() {
            contacts = {};
            var data = JSON.parse(output);
            if (data.ok !== true) {
                console.error('Unable to update contacts from Slack');
                return;
            }
            for (var i in data.members) {
                if (!data.members.hasOwnProperty(i)) {
                    continue;
                }
                var contact = data.members[i];
                contacts[contact.id] = {
                    dn: 'cn=' + contact.name + ', dc=example, dc=com',
                    attributes: {
                        objectclass: [ "person", "inetOrgPerson"],
                        cn: contact.profile.real_name,
                        mail: contact.profile.email,
                        homephone: contact.profile.phone,
                        givenname: contact.profile.first_name,
                        jpegPhoto: contact.profile.image_192,
                        sn: contact.profile.last_name,
                        ou: organizationName
                    }
                };
            }
            console.log('Updated ' + contacts.length + ' contacts');
        });
    });
};

fetchContacts();
setInterval(fetchContacts, updateInterval);

server.search('o='+organizationName.toLowerCase(), function(req, res, next) {
  Object.keys(contacts).forEach(function(k) {
    if (req.filter.matches(contacts[k].attributes))
      res.send(contacts[k]);
  });

  res.end();
  return next();
});

server.listen(port, function() {
    console.log('LDAP server listening at %s', server.url);
});
