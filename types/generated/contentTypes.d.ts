import type { Schema, Attribute } from '@strapi/strapi';

export interface AdminPermission extends Schema.CollectionType {
  collectionName: 'admin_permissions';
  info: {
    name: 'Permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    role: Attribute.Relation<'admin::permission', 'manyToOne', 'admin::role'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: 'admin_users';
  info: {
    name: 'User';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    username: Attribute.String;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    registrationToken: Attribute.String & Attribute.Private;
    isActive: Attribute.Boolean &
      Attribute.Private &
      Attribute.DefaultTo<false>;
    roles: Attribute.Relation<'admin::user', 'manyToMany', 'admin::role'> &
      Attribute.Private;
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    preferedLanguage: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: 'admin_roles';
  info: {
    name: 'Role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String;
    users: Attribute.Relation<'admin::role', 'manyToMany', 'admin::user'>;
    permissions: Attribute.Relation<
      'admin::role',
      'oneToMany',
      'admin::permission'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: 'strapi_api_tokens';
  info: {
    name: 'Api Token';
    singularName: 'api-token';
    pluralName: 'api-tokens';
    displayName: 'Api Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    type: Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Attribute.Required &
      Attribute.DefaultTo<'read-only'>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::api-token',
      'oneToMany',
      'admin::api-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_api_token_permissions';
  info: {
    name: 'API Token Permission';
    description: '';
    singularName: 'api-token-permission';
    pluralName: 'api-token-permissions';
    displayName: 'API Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::api-token-permission',
      'manyToOne',
      'admin::api-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: 'strapi_transfer_tokens';
  info: {
    name: 'Transfer Token';
    singularName: 'transfer-token';
    pluralName: 'transfer-tokens';
    displayName: 'Transfer Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::transfer-token',
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    name: 'Transfer Token Permission';
    description: '';
    singularName: 'transfer-token-permission';
    pluralName: 'transfer-token-permissions';
    displayName: 'Transfer Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::transfer-token-permission',
      'manyToOne',
      'admin::transfer-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: 'files';
  info: {
    singularName: 'file';
    pluralName: 'files';
    displayName: 'File';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    alternativeText: Attribute.String;
    caption: Attribute.String;
    width: Attribute.Integer;
    height: Attribute.Integer;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    ext: Attribute.String;
    mime: Attribute.String & Attribute.Required;
    size: Attribute.Decimal & Attribute.Required;
    url: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<'plugin::upload.file', 'morphToMany'>;
    folder: Attribute.Relation<
      'plugin::upload.file',
      'manyToOne',
      'plugin::upload.folder'
    > &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: 'upload_folders';
  info: {
    singularName: 'folder';
    pluralName: 'folders';
    displayName: 'Folder';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    parent: Attribute.Relation<
      'plugin::upload.folder',
      'manyToOne',
      'plugin::upload.folder'
    >;
    children: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.folder'
    >;
    files: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.file'
    >;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: 'strapi_releases';
  info: {
    singularName: 'release';
    pluralName: 'releases';
    displayName: 'Release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    timezone: Attribute.String;
    status: Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Attribute.Required;
    actions: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Schema.CollectionType {
  collectionName: 'strapi_release_actions';
  info: {
    singularName: 'release-action';
    pluralName: 'release-actions';
    displayName: 'Release Action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    type: Attribute.Enumeration<['publish', 'unpublish']> & Attribute.Required;
    entry: Attribute.Relation<
      'plugin::content-releases.release-action',
      'morphToOne'
    >;
    contentType: Attribute.String & Attribute.Required;
    locale: Attribute.String;
    release: Attribute.Relation<
      'plugin::content-releases.release-action',
      'manyToOne',
      'plugin::content-releases.release'
    >;
    isEntryValid: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginI18NLocale extends Schema.CollectionType {
  collectionName: 'i18n_locale';
  info: {
    singularName: 'locale';
    pluralName: 'locales';
    collectionName: 'locales';
    displayName: 'Locale';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.SetMinMax<
        {
          min: 1;
          max: 50;
        },
        number
      >;
    code: Attribute.String & Attribute.Unique;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Schema.CollectionType {
  collectionName: 'up_permissions';
  info: {
    name: 'permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    role: Attribute.Relation<
      'plugin::users-permissions.permission',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: 'up_roles';
  info: {
    name: 'role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    description: Attribute.String;
    type: Attribute.String & Attribute.Unique;
    permissions: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    users: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: 'up_users';
  info: {
    name: 'user';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    email: Attribute.Email & Attribute.Required;
    provider: Attribute.String;
    password: Attribute.Password & Attribute.Private;
    resetPasswordToken: Attribute.String & Attribute.Private;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    role: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    role_type: Attribute.Enumeration<['guest', 'host', 'agent', 'agency']> &
      Attribute.DefaultTo<'guest'>;
    avatar: Attribute.Media;
    bio: Attribute.Text;
    phone: Attribute.String;
    whatsappNumber: Attribute.String;
    website: Attribute.String;
    verification_status: Attribute.Enumeration<
      ['unverified', 'pending', 'verified']
    > &
      Attribute.DefaultTo<'unverified'>;
    agency: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'api::agency.agency'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAgencyAgency extends Schema.CollectionType {
  collectionName: 'agencies';
  info: {
    singularName: 'agency';
    pluralName: 'agencies';
    displayName: 'Agency';
    description: 'Represents a real estate agency or property management company.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    legalName: Attribute.String;
    slug: Attribute.UID<'api::agency.agency', 'name'>;
    logo: Attribute.Media;
    description: Attribute.Text;
    website: Attribute.String;
    email: Attribute.Email;
    primaryContactEmail: Attribute.Email;
    phone: Attribute.String;
    whatsappNumber: Attribute.String;
    address: Attribute.String;
    status: Attribute.Enumeration<['pending', 'active', 'suspended']> &
      Attribute.DefaultTo<'pending'>;
    isVerified: Attribute.Boolean & Attribute.DefaultTo<false>;
    brandColors: Attribute.JSON;
    agents: Attribute.Relation<
      'api::agency.agency',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    verificationToken: Attribute.String & Attribute.Private;
    verificationDomain: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::agency.agency',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::agency.agency',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAgencyMembershipAgencyMembership
  extends Schema.CollectionType {
  collectionName: 'agency_memberships';
  info: {
    singularName: 'agency-membership';
    pluralName: 'agency-memberships';
    displayName: 'AgencyMembership';
    description: 'Links a user to an agency with a role and permission scope.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    agency: Attribute.Relation<
      'api::agency-membership.agency-membership',
      'manyToOne',
      'api::agency.agency'
    > &
      Attribute.Required;
    user: Attribute.Relation<
      'api::agency-membership.agency-membership',
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Attribute.Required;
    role: Attribute.Enumeration<['owner', 'manager', 'agent', 'staff']> &
      Attribute.Required &
      Attribute.DefaultTo<'agent'>;
    permissionsJson: Attribute.JSON;
    status: Attribute.Enumeration<['active', 'suspended', 'invited']> &
      Attribute.Required &
      Attribute.DefaultTo<'invited'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::agency-membership.agency-membership',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::agency-membership.agency-membership',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAgentTestimonialAgentTestimonial
  extends Schema.CollectionType {
  collectionName: 'agent_testimonials';
  info: {
    singularName: 'agent-testimonial';
    pluralName: 'agent-testimonials';
    displayName: 'AgentTestimonial';
    description: 'Client testimonials attributed to a specific agent user.';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    agentUserId: Attribute.Integer & Attribute.Required;
    clientName: Attribute.String & Attribute.Required;
    clientRole: Attribute.String;
    quote: Attribute.Text & Attribute.Required;
    rating: Attribute.Integer &
      Attribute.SetMinMax<
        {
          min: 1;
          max: 5;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::agent-testimonial.agent-testimonial',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::agent-testimonial.agent-testimonial',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiArticleArticle extends Schema.CollectionType {
  collectionName: 'articles';
  info: {
    singularName: 'article';
    pluralName: 'articles';
    displayName: 'article';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    articleDate: Attribute.Date & Attribute.Required;
    title: Attribute.String &
      Attribute.Required &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    slug: Attribute.UID<'api::article.article', 'title'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    articleBody: Attribute.RichText &
      Attribute.Required &
      Attribute.CustomField<
        'plugin::ckeditor.CKEditor',
        {
          output: 'HTML';
          preset: 'rich';
        }
      > &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    sections: Attribute.DynamicZone<['sections.related-articles']> &
      Attribute.Required &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    articleTag: Attribute.Component<'shared.listing-tag'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    articleHeadImg: Attribute.Component<'blocks.article-head-img'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    articlePreview: Attribute.Component<'blocks.article-preview'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    seo: Attribute.Component<'shared.seo'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::article.article',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::article.article',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::article.article',
      'oneToMany',
      'api::article.article'
    >;
    locale: Attribute.String;
  };
}

export interface ApiBlockedDomainBlockedDomain extends Schema.CollectionType {
  collectionName: 'blocked_domains';
  info: {
    singularName: 'blocked-domain';
    pluralName: 'blocked-domains';
    displayName: 'BlockedDomain';
    description: 'Admin-configurable list of domains that cannot be used as source connections.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    domain: Attribute.String & Attribute.Required & Attribute.Unique;
    reason: Attribute.String;
    domainType: Attribute.Enumeration<
      ['aggregator', 'portal', 'competitor', 'spam']
    > &
      Attribute.DefaultTo<'aggregator'>;
    addedAt: Attribute.DateTime;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::blocked-domain.blocked-domain',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::blocked-domain.blocked-domain',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiBrandProfileBrandProfile extends Schema.CollectionType {
  collectionName: 'brand_profiles';
  info: {
    singularName: 'brand-profile';
    pluralName: 'brand-profiles';
    displayName: 'BrandProfile';
    description: 'Per-agency branding: logo, colours, about, social links, office locations.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    agency: Attribute.Relation<
      'api::brand-profile.brand-profile',
      'oneToOne',
      'api::agency.agency'
    > &
      Attribute.Required;
    logo: Attribute.Media;
    coverImage: Attribute.Media;
    brandPrimaryColor: Attribute.String;
    brandSecondaryColor: Attribute.String;
    description: Attribute.Text;
    officeLocationsJson: Attribute.JSON;
    socialLinksJson: Attribute.JSON;
    ctaText: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::brand-profile.brand-profile',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::brand-profile.brand-profile',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCanonicalListingCanonicalListing
  extends Schema.CollectionType {
  collectionName: 'canonical_listings';
  info: {
    singularName: 'canonical-listing';
    pluralName: 'canonical-listings';
    displayName: 'CanonicalListing';
    description: 'Structured property listing entity. Separate from the CMS Listing content type. This is the source of truth for search, display, and agent workspace.';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    slug: Attribute.UID<'api::canonical-listing.canonical-listing', 'title'> &
      Attribute.Required;
    inventoryMode: Attribute.Enumeration<
      ['native', 'imported_unclaimed', 'imported_claimed', 'hybrid']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'native'>;
    status: Attribute.Enumeration<
      [
        'draft',
        'ready',
        'active',
        'suppressed',
        'under_offer',
        'sold',
        'rented',
        'archived'
      ]
    > &
      Attribute.Required &
      Attribute.DefaultTo<'draft'>;
    propertyCategory: Attribute.Enumeration<
      ['residential', 'land', 'commercial', 'commercial_land', 'short_stay']
    > &
      Attribute.Required;
    transactionType: Attribute.Enumeration<
      ['for_sale', 'for_rent', 'short_stay']
    > &
      Attribute.Required;
    buildingType: Attribute.Enumeration<
      [
        'house',
        'chattel_house',
        'apartment',
        'condo',
        'townhouse',
        'villa',
        'penthouse',
        'studio',
        'duplex',
        'office',
        'retail',
        'warehouse',
        'mixed_use',
        'hotel'
      ]
    >;
    utilitiesIncluded: Attribute.Boolean & Attribute.DefaultTo<false>;
    bookingMode: Attribute.Enumeration<
      ['referral_only', 'enquiry_only', 'request_to_book', 'instant_book']
    > &
      Attribute.DefaultTo<'enquiry_only'>;
    title: Attribute.String & Attribute.Required;
    description: Attribute.Text;
    priceDisplay: Attribute.String;
    priceMinor: Attribute.Integer;
    currency: Attribute.Enumeration<['BBD', 'USD', 'EUR', 'GBP']> &
      Attribute.DefaultTo<'BBD'>;
    addressLine1: Attribute.String;
    addressLine2: Attribute.String;
    locality: Attribute.String;
    parish: Attribute.Enumeration<
      [
        'Christ Church',
        'St Andrew',
        'St George',
        'St James',
        'St John',
        'St Joseph',
        'St Lucy',
        'St Michael',
        'St Peter',
        'St Philip',
        'St Thomas'
      ]
    >;
    postcode: Attribute.String;
    countryCode: Attribute.String & Attribute.DefaultTo<'BB'>;
    lat: Attribute.Decimal;
    lng: Attribute.Decimal;
    bedrooms: Attribute.Integer;
    bathrooms: Attribute.Integer;
    parkingSpaces: Attribute.Integer;
    landSizeSqm: Attribute.Decimal;
    landSizeAcres: Attribute.Decimal;
    landSizeHectares: Attribute.Decimal;
    landSizeValueOriginal: Attribute.String;
    landSizeUnitOriginal: Attribute.String;
    buildingSizeSqm: Attribute.Decimal;
    buildingSizeValueOriginal: Attribute.String;
    buildingSizeUnitOriginal: Attribute.String;
    zoning: Attribute.String;
    sourceLabel: Attribute.String;
    sourceDomain: Attribute.String;
    sourceUrl: Attribute.String;
    attributionText: Attribute.String;
    firstPublishedAt: Attribute.DateTime;
    lastSyncedAt: Attribute.DateTime;
    ownerAgency: Attribute.Relation<
      'api::canonical-listing.canonical-listing',
      'manyToOne',
      'api::agency.agency'
    >;
    ownerUser: Attribute.Relation<
      'api::canonical-listing.canonical-listing',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    primaryMedia: Attribute.Media;
    media: Attribute.Media;
    inventoryOriginType: Attribute.Enumeration<['imported', 'native']> &
      Attribute.DefaultTo<'native'>;
    inventoryPolicyStatus: Attribute.Enumeration<
      ['allowed', 'blocked', 'review_required']
    > &
      Attribute.DefaultTo<'allowed'>;
    nativeShortTermManaged: Attribute.Boolean & Attribute.DefaultTo<false>;
    freshnessStatus: Attribute.Enumeration<['fresh', 'stale', 'unknown']> &
      Attribute.DefaultTo<'unknown'>;
    neighborhood: Attribute.String;
    hurricaneShutters: Attribute.Enumeration<
      ['None', 'Manual', 'Accordion', 'Electric']
    > &
      Attribute.DefaultTo<'None'>;
    cisternCapacity: Attribute.Integer;
    backupGenerator: Attribute.Text;
    viewProfile: Attribute.JSON;
    coastlineProximity: Attribute.Enumeration<
      ['Beachfront', 'Near-Beach', 'Coastal View']
    >;
    featured: Attribute.Boolean & Attribute.DefaultTo<false>;
    promotedUntil: Attribute.DateTime;
    nightlyRateMinor: Attribute.Integer;
    minStayNights: Attribute.Integer;
    maxStayNights: Attribute.Integer;
    checkInTime: Attribute.String;
    checkOutTime: Attribute.String;
    features: Attribute.Relation<
      'api::canonical-listing.canonical-listing',
      'oneToMany',
      'api::listing-feature.listing-feature'
    >;
    spaces: Attribute.Relation<
      'api::canonical-listing.canonical-listing',
      'oneToMany',
      'api::listing-space.listing-space'
    >;
    availabilities: Attribute.Relation<
      'api::canonical-listing.canonical-listing',
      'oneToMany',
      'api::listing-availability.listing-availability'
    >;
    seo: Attribute.Component<'shared.seo'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::canonical-listing.canonical-listing',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::canonical-listing.canonical-listing',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiContactFormContactForm extends Schema.CollectionType {
  collectionName: 'contact_forms';
  info: {
    singularName: 'contact-form';
    pluralName: 'contact-forms';
    displayName: 'contactForm';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    fullName: Attribute.String;
    phoneNumber: Attribute.String;
    emailAddress: Attribute.Email & Attribute.Required;
    message: Attribute.Text & Attribute.Required;
    status: Attribute.Enumeration<['unread', 'read', 'replied']> &
      Attribute.Required &
      Attribute.DefaultTo<'unread'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::contact-form.contact-form',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::contact-form.contact-form',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiFavoriteFavorite extends Schema.CollectionType {
  collectionName: 'favorites';
  info: {
    singularName: 'favorite';
    pluralName: 'favorites';
    displayName: 'Favorite';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    user: Attribute.Relation<
      'api::favorite.favorite',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    listing: Attribute.Relation<
      'api::favorite.favorite',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::favorite.favorite',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::favorite.favorite',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiFilterOptionFilterOption extends Schema.CollectionType {
  collectionName: 'filter_options';
  info: {
    singularName: 'filter-option';
    pluralName: 'filter-options';
    displayName: 'filterOption';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    icon: Attribute.Media;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::filter-option.filter-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::filter-option.filter-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiGuideArticleGuideArticle extends Schema.CollectionType {
  collectionName: 'guide_articles';
  info: {
    singularName: 'guide-article';
    pluralName: 'guide-articles';
    displayName: 'Guide Article';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    slug: Attribute.UID<'api::guide-article.guide-article', 'title'> &
      Attribute.Required;
    excerpt: Attribute.Text & Attribute.Required;
    body: Attribute.RichText & Attribute.Required;
    heroImage: Attribute.Media;
    category: Attribute.Enumeration<
      [
        'macroeconomics',
        'finance',
        'legal',
        'geography',
        'costs_and_tax',
        'ownership_structure',
        'residency',
        'maintenance',
        'sustainability'
      ]
    >;
    readTimeMinutes: Attribute.Integer;
    sortOrder: Attribute.Integer;
    metaTitle: Attribute.String;
    metaDescription: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::guide-article.guide-article',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::guide-article.guide-article',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiHomePageHomePage extends Schema.SingleType {
  collectionName: 'home_pages';
  info: {
    singularName: 'home-page';
    pluralName: 'home-pages';
    displayName: 'homePage';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    banner: Attribute.Component<'global.banner'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    navigation: Attribute.Component<'global.navigation'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    footer: Attribute.Component<'sections.footer'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    homePageMain: Attribute.Relation<
      'api::home-page.home-page',
      'oneToOne',
      'api::page-content.page-content'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::home-page.home-page',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::home-page.home-page',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::home-page.home-page',
      'oneToMany',
      'api::home-page.home-page'
    >;
    locale: Attribute.String;
  };
}

export interface ApiLeadLead extends Schema.CollectionType {
  collectionName: 'leads';
  info: {
    singularName: 'lead';
    pluralName: 'leads';
    displayName: 'Lead';
    description: 'Enquiries submitted by prospective buyers and renters via listing detail pages.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    email: Attribute.Email & Attribute.Required;
    phone: Attribute.String;
    message: Attribute.Text;
    leadSource: Attribute.Enumeration<
      [
        'listing_enquiry',
        'short_stay_enquiry',
        'whatsapp_click',
        'phone_click',
        'email_reveal',
        'source_referral'
      ]
    > &
      Attribute.DefaultTo<'listing_enquiry'>;
    status: Attribute.Enumeration<
      [
        'new',
        'assigned',
        'contacted',
        'qualified',
        'unqualified',
        'won',
        'lost',
        'spam',
        'archived'
      ]
    > &
      Attribute.DefaultTo<'new'>;
    notes: Attribute.Text;
    listingTitle: Attribute.String;
    listingSlug: Attribute.String;
    listing: Attribute.Relation<
      'api::lead.lead',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    >;
    agency: Attribute.Relation<
      'api::lead.lead',
      'manyToOne',
      'api::agency.agency'
    >;
    assignedTo: Attribute.Relation<
      'api::lead.lead',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::lead.lead', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::lead.lead', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiListingListing extends Schema.CollectionType {
  collectionName: 'listings';
  info: {
    singularName: 'listing';
    pluralName: 'listings';
    displayName: 'listing';
    description: 'CMS page-builder listing \u2014 for marketing display only. See CanonicalListing for the structured data entity.';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    title: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    slug: Attribute.UID<'api::listing.listing', 'title'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    sliderImages: Attribute.Media &
      Attribute.Required &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    listingDetailsHead: Attribute.Component<'blocks.listing-details'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    listingDetailsBody: Attribute.Component<'blocks.listing-details-body'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    sections: Attribute.DynamicZone<['sections.recent-listings']> &
      Attribute.Required &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    listingPreviewImg: Attribute.Media &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    listingProps: Attribute.Component<'sections.listing-props', true> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    listingType: Attribute.Enumeration<
      [
        'residential_sale',
        'residential_rent',
        'land',
        'commercial',
        'short_stay'
      ]
    > &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    listingPreviewImgLarge: Attribute.Media &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    pricePerNight: Attribute.Decimal &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    owner: Attribute.Relation<
      'api::listing.listing',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::listing.listing',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::listing.listing',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::listing.listing',
      'oneToMany',
      'api::listing.listing'
    >;
    locale: Attribute.String;
  };
}

export interface ApiListingAvailabilityListingAvailability
  extends Schema.CollectionType {
  collectionName: 'listing_availabilities';
  info: {
    singularName: 'listing-availability';
    pluralName: 'listing-availabilities';
    displayName: 'ListingAvailability';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    listing: Attribute.Relation<
      'api::listing-availability.listing-availability',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    >;
    date: Attribute.Date & Attribute.Required;
    availabilityStatus: Attribute.Enumeration<
      ['available', 'blocked', 'booked']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'available'>;
    nightlyPriceMinor: Attribute.Integer;
    minStayNights: Attribute.Integer;
    source: Attribute.Enumeration<
      ['host_override', 'platform_rule', 'reservation_engine']
    > &
      Attribute.DefaultTo<'host_override'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::listing-availability.listing-availability',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::listing-availability.listing-availability',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiListingFeatureListingFeature extends Schema.CollectionType {
  collectionName: 'listing_features';
  info: {
    singularName: 'listing-feature';
    pluralName: 'listing-features';
    displayName: 'ListingFeature';
    description: 'Amenity and specification key-value pairs per canonical listing.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    listing: Attribute.Relation<
      'api::listing-feature.listing-feature',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    > &
      Attribute.Required;
    featureKey: Attribute.String & Attribute.Required;
    featureValue: Attribute.String;
    source: Attribute.Enumeration<['agent', 'admin', 'sync', 'system']> &
      Attribute.DefaultTo<'agent'>;
    category: Attribute.Enumeration<
      [
        'infrastructure',
        'outdoor',
        'interior',
        'community',
        'accessibility',
        'lifestyle'
      ]
    > &
      Attribute.DefaultTo<'lifestyle'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::listing-feature.listing-feature',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::listing-feature.listing-feature',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiListingFormListingForm extends Schema.CollectionType {
  collectionName: 'listing_forms';
  info: {
    singularName: 'listing-form';
    pluralName: 'listing-forms';
    displayName: 'listingForm';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    emailAddress: Attribute.Email &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    phoneNumber: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    tourOption: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::listing-form.listing-form',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::listing-form.listing-form',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::listing-form.listing-form',
      'oneToMany',
      'api::listing-form.listing-form'
    >;
    locale: Attribute.String;
  };
}

export interface ApiListingHistoryListingHistory extends Schema.CollectionType {
  collectionName: 'listing_histories';
  info: {
    singularName: 'listing-history';
    pluralName: 'listing-histories';
    displayName: 'ListingHistory';
    description: 'Field-level change log for canonical listings.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    listing: Attribute.Relation<
      'api::listing-history.listing-history',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    > &
      Attribute.Required;
    changedField: Attribute.String & Attribute.Required;
    previousValueJson: Attribute.JSON;
    nextValueJson: Attribute.JSON;
    changeSource: Attribute.Enumeration<['agent', 'admin', 'sync', 'system']> &
      Attribute.Required;
    changedAt: Attribute.DateTime & Attribute.Required;
    changedByUser: Attribute.Relation<
      'api::listing-history.listing-history',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::listing-history.listing-history',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::listing-history.listing-history',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiListingMediaListingMedia extends Schema.CollectionType {
  collectionName: 'listing_media';
  info: {
    singularName: 'listing-media';
    pluralName: 'listing-medias';
    displayName: 'ListingMedia';
    description: 'Ordered media assets per canonical listing with rights tracking.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    listing: Attribute.Relation<
      'api::listing-media.listing-media',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    > &
      Attribute.Required;
    asset: Attribute.Media & Attribute.Required;
    caption: Attribute.String;
    sortOrder: Attribute.Integer & Attribute.DefaultTo<0>;
    copyrightNotice: Attribute.String;
    rightsGranted: Attribute.Enumeration<
      ['all_rights', 'display_only', 'attributed']
    > &
      Attribute.DefaultTo<'display_only'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::listing-media.listing-media',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::listing-media.listing-media',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiListingSpaceListingSpace extends Schema.CollectionType {
  collectionName: 'listing_spaces';
  info: {
    singularName: 'listing-space';
    pluralName: 'listing-spaces';
    displayName: 'ListingSpace';
    description: 'Room-by-room media sections for a canonical listing.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    listing: Attribute.Relation<
      'api::listing-space.listing-space',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    >;
    spaceType: Attribute.Enumeration<
      [
        'living_room',
        'kitchen',
        'dining',
        'primary_suite',
        'bedroom',
        'bathroom',
        'office',
        'outdoor',
        'pool',
        'garden',
        'garage',
        'other'
      ]
    > &
      Attribute.Required;
    title: Attribute.String;
    description: Attribute.Text;
    sortOrder: Attribute.Integer & Attribute.DefaultTo<0>;
    media: Attribute.Media;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::listing-space.listing-space',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::listing-space.listing-space',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiNavLinkNavLink extends Schema.CollectionType {
  collectionName: 'nav_links';
  info: {
    singularName: 'nav-link';
    pluralName: 'nav-links';
    displayName: 'navLink';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    href: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    label: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    target: Attribute.Enumeration<['_blank']> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    isExternal: Attribute.Boolean &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    title: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    icon: Attribute.Media &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::nav-link.nav-link',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::nav-link.nav-link',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::nav-link.nav-link',
      'oneToMany',
      'api::nav-link.nav-link'
    >;
    locale: Attribute.String;
  };
}

export interface ApiPageContentPageContent extends Schema.CollectionType {
  collectionName: 'page_contents';
  info: {
    singularName: 'page-content';
    pluralName: 'page-contents';
    displayName: 'pageContent';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    title: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    slug: Attribute.UID<'api::page-content.page-content', 'title'> &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    sections: Attribute.DynamicZone<
      [
        'shared.button',
        'shared.header',
        'shared.listing-tag',
        'shared.items-per-page',
        'sections.recent-listings',
        'sections.related-articles',
        'sections.process-details',
        'sections.faq',
        'sections.contact',
        'sections.exclusive-listing',
        'blocks.contact-card',
        'blocks.contact-form',
        'blocks.blog-filter',
        'blocks.listing-filter',
        'sections.hero'
      ]
    > &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::page-content.page-content',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::page-content.page-content',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::page-content.page-content',
      'oneToMany',
      'api::page-content.page-content'
    >;
    locale: Attribute.String;
  };
}

export interface ApiPlanPlan extends Schema.CollectionType {
  collectionName: 'plans';
  info: {
    singularName: 'plan';
    pluralName: 'plans';
    displayName: 'Plan';
    description: 'Platform subscription plan definitions. Seeded as platform config.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    slug: Attribute.Enumeration<['free', 'starter', 'pro', 'agency']> &
      Attribute.Required &
      Attribute.Unique;
    priceUsdMonthly: Attribute.Integer & Attribute.DefaultTo<0>;
    nativeListingLimit: Attribute.Integer & Attribute.DefaultTo<5>;
    importedListingLimit: Attribute.Integer & Attribute.DefaultTo<0>;
    sourceConnectionLimit: Attribute.Integer & Attribute.DefaultTo<0>;
    teamSeatLimit: Attribute.Integer & Attribute.DefaultTo<1>;
    featuredSlots: Attribute.Integer & Attribute.DefaultTo<0>;
    syncFrequency: Attribute.Enumeration<
      ['none', 'weekly', 'daily', 'hourly']
    > &
      Attribute.DefaultTo<'none'>;
    analyticsLevel: Attribute.Enumeration<
      ['basic', 'full', 'full_attribution']
    > &
      Attribute.DefaultTo<'basic'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::plan.plan', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::plan.plan', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiPolicyBlockEventPolicyBlockEvent
  extends Schema.CollectionType {
  collectionName: 'policy_block_events';
  info: {
    singularName: 'policy-block-event';
    pluralName: 'policy-block-events';
    displayName: 'PolicyBlockEvent';
    description: 'Audit record for a candidate listing blocked by inventory policy (e.g. short-term classification).';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    sourceConnection: Attribute.Relation<
      'api::policy-block-event.policy-block-event',
      'manyToOne',
      'api::source-connection.source-connection'
    >;
    sourceListing: Attribute.Relation<
      'api::policy-block-event.policy-block-event',
      'manyToOne',
      'api::source-listing.source-listing'
    >;
    sourceUrl: Attribute.String;
    candidateInventoryType: Attribute.String;
    blockReasonCode: Attribute.String;
    classifierOutputJson: Attribute.JSON;
    actionTaken: Attribute.Enumeration<
      [
        'auto_blocked',
        'sent_to_review',
        'confirmed_by_reviewer',
        'overridden_by_admin'
      ]
    > &
      Attribute.DefaultTo<'auto_blocked'>;
    reviewedAt: Attribute.DateTime;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::policy-block-event.policy-block-event',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::policy-block-event.policy-block-event',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPropertySubmissionPropertySubmission
  extends Schema.CollectionType {
  collectionName: 'property_submissions';
  info: {
    singularName: 'property-submission';
    pluralName: 'property-submissions';
    displayName: 'PropertySubmission';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    fullName: Attribute.String;
    emailAddress: Attribute.Email;
    phoneNumber: Attribute.String;
    address: Attribute.String;
    property: Attribute.String;
    propertyStatus: Attribute.Enumeration<['for_sale', 'for_rent', 'both']>;
    beds: Attribute.Integer;
    baths: Attribute.Integer;
    area: Attribute.Decimal;
    services: Attribute.String;
    floor: Attribute.String;
    description: Attribute.Text;
    mediaLink: Attribute.String;
    garden: Attribute.Boolean & Attribute.DefaultTo<false>;
    security: Attribute.Boolean & Attribute.DefaultTo<false>;
    laundry: Attribute.Boolean & Attribute.DefaultTo<false>;
    elevator: Attribute.Boolean & Attribute.DefaultTo<false>;
    pool: Attribute.Boolean & Attribute.DefaultTo<false>;
    garage: Attribute.Boolean & Attribute.DefaultTo<false>;
    internet: Attribute.Boolean & Attribute.DefaultTo<false>;
    dishWasher: Attribute.Boolean & Attribute.DefaultTo<false>;
    listingPrice: Attribute.Decimal;
    petsAllowed: Attribute.Enumeration<['yes', 'no', 'negotiable']>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::property-submission.property-submission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::property-submission.property-submission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::property-submission.property-submission',
      'oneToMany',
      'api::property-submission.property-submission'
    >;
    locale: Attribute.String;
  };
}

export interface ApiReservationReservation extends Schema.CollectionType {
  collectionName: 'reservations';
  info: {
    singularName: 'reservation';
    pluralName: 'reservations';
    displayName: 'Reservation';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    listing: Attribute.Relation<
      'api::reservation.reservation',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    >;
    guestUser: Attribute.Relation<
      'api::reservation.reservation',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    checkIn: Attribute.Date & Attribute.Required;
    checkOut: Attribute.Date & Attribute.Required;
    nights: Attribute.Integer;
    guestCount: Attribute.Integer;
    status: Attribute.Enumeration<
      ['pending', 'confirmed', 'cancelled', 'completed']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'pending'>;
    totalMinor: Attribute.Integer;
    currency: Attribute.Enumeration<['BBD', 'USD', 'EUR', 'GBP']> &
      Attribute.DefaultTo<'BBD'>;
    guestNotes: Attribute.Text;
    hostNotes: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::reservation.reservation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::reservation.reservation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSavedSearchSavedSearch extends Schema.CollectionType {
  collectionName: 'saved_searches';
  info: {
    singularName: 'saved-search';
    pluralName: 'saved-searches';
    displayName: 'SavedSearch';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    filtersJson: Attribute.JSON & Attribute.Required;
    alertEnabled: Attribute.Boolean & Attribute.DefaultTo<false>;
    lastAlertedAt: Attribute.DateTime;
    clientName: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    clientNote: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 300;
      }>;
    user: Attribute.Relation<
      'api::saved-search.saved-search',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::saved-search.saved-search',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::saved-search.saved-search',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSortOptionSortOption extends Schema.CollectionType {
  collectionName: 'sort_options';
  info: {
    singularName: 'sort-option';
    pluralName: 'sort-options';
    displayName: 'sortOption';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    i18n: {
      localized: true;
    };
  };
  attributes: {
    title: Attribute.String &
      Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::sort-option.sort-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::sort-option.sort-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    localizations: Attribute.Relation<
      'api::sort-option.sort-option',
      'oneToMany',
      'api::sort-option.sort-option'
    >;
    locale: Attribute.String;
  };
}

export interface ApiSourceConnectionSourceConnection
  extends Schema.CollectionType {
  collectionName: 'source_connections';
  info: {
    singularName: 'source-connection';
    pluralName: 'source-connections';
    displayName: 'SourceConnection';
    description: 'Represents the import relationship for automated listing ingestion.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    domain: Attribute.String & Attribute.Required & Attribute.Unique;
    verificationToken: Attribute.String;
    verificationStatus: Attribute.Enumeration<
      ['unverified', 'pending', 'verified']
    > &
      Attribute.DefaultTo<'unverified'>;
    connectionType: Attribute.Enumeration<['sitemap', 'api', 'rss', 'manual']> &
      Attribute.DefaultTo<'sitemap'>;
    syncFrequency: Attribute.Enumeration<['hourly', 'daily', 'weekly']> &
      Attribute.DefaultTo<'daily'>;
    lastSyncAt: Attribute.DateTime;
    syncStatus: Attribute.Enumeration<
      ['idle', 'running', 'failed', 'success']
    > &
      Attribute.DefaultTo<'idle'>;
    owner: Attribute.Relation<
      'api::source-connection.source-connection',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    allowedPaths: Attribute.JSON;
    blockedPaths: Attribute.JSON;
    agency: Attribute.Relation<
      'api::source-connection.source-connection',
      'manyToOne',
      'api::agency.agency'
    >;
    active: Attribute.Boolean & Attribute.DefaultTo<false>;
    blockShortTermImports: Attribute.Boolean & Attribute.DefaultTo<true>;
    allowedInventoryTypesJson: Attribute.JSON;
    blockedInventoryTypesJson: Attribute.JSON;
    policyNotes: Attribute.Text;
    lastSuccessfulSyncAt: Attribute.DateTime;
    lastErrorAt: Attribute.DateTime;
    domainType: Attribute.Enumeration<
      [
        'agent_website',
        'agency_website',
        'aggregator',
        'portal',
        'ical_feed',
        'unknown'
      ]
    > &
      Attribute.DefaultTo<'unknown'>;
    startUrl: Attribute.String;
    agentNameFilter: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::source-connection.source-connection',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::source-connection.source-connection',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSourceListingSourceListing extends Schema.CollectionType {
  collectionName: 'source_listings';
  info: {
    singularName: 'source-listing';
    pluralName: 'source-listings';
    displayName: 'SourceListing';
    description: 'Raw imported listing record from a source connection. Never overwritten after initial capture.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    sourceConnection: Attribute.Relation<
      'api::source-listing.source-listing',
      'manyToOne',
      'api::source-connection.source-connection'
    >;
    sourceUrl: Attribute.String;
    externalListingId: Attribute.String;
    sourceType: Attribute.String;
    rawPayloadJson: Attribute.JSON;
    crawlHash: Attribute.String;
    firstSeenAt: Attribute.DateTime;
    lastSeenAt: Attribute.DateTime;
    importStatus: Attribute.Enumeration<
      ['pending', 'accepted', 'blocked', 'review_required', 'failed']
    > &
      Attribute.DefaultTo<'pending'>;
    confidenceScore: Attribute.Decimal;
    suppressedByOwner: Attribute.Boolean & Attribute.DefaultTo<false>;
    candidateInventoryType: Attribute.String;
    blockedByPolicy: Attribute.Boolean & Attribute.DefaultTo<false>;
    blockReasonCode: Attribute.String;
    classifierVersion: Attribute.String;
    policyDecisionAt: Attribute.DateTime;
    canonicalListing: Attribute.Relation<
      'api::source-listing.source-listing',
      'manyToOne',
      'api::canonical-listing.canonical-listing'
    >;
    reviewStatus: Attribute.Enumeration<
      ['pending_review', 'approved', 'rejected']
    > &
      Attribute.DefaultTo<'pending_review'>;
    duplicateWarning: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::source-listing.source-listing',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::source-listing.source-listing',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSubscriptionSubscription extends Schema.CollectionType {
  collectionName: 'subscriptions';
  info: {
    singularName: 'subscription';
    pluralName: 'subscriptions';
    displayName: 'Subscription';
    description: 'User subscription to a plan tier.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    user: Attribute.Relation<
      'api::subscription.subscription',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    agency: Attribute.Relation<
      'api::subscription.subscription',
      'manyToOne',
      'api::agency.agency'
    >;
    plan: Attribute.Relation<
      'api::subscription.subscription',
      'manyToOne',
      'api::plan.plan'
    >;
    status: Attribute.Enumeration<
      ['active', 'past_due', 'cancelled', 'trialing']
    > &
      Attribute.DefaultTo<'active'>;
    stripeSubscriptionId: Attribute.String;
    stripeCustomerId: Attribute.String;
    currentPeriodEnd: Attribute.DateTime;
    cancelAtPeriodEnd: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::subscription.subscription',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::subscription.subscription',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSyncRunSyncRun extends Schema.CollectionType {
  collectionName: 'sync_runs';
  info: {
    singularName: 'sync-run';
    pluralName: 'sync-runs';
    displayName: 'SyncRun';
    description: 'Audit record for a single ingestion sync job.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    sourceConnection: Attribute.Relation<
      'api::sync-run.sync-run',
      'manyToOne',
      'api::source-connection.source-connection'
    >;
    startedAt: Attribute.DateTime;
    finishedAt: Attribute.DateTime;
    status: Attribute.Enumeration<
      [
        'queued',
        'running',
        'completed',
        'completed_with_warnings',
        'partial_success',
        'failed',
        'cancelled'
      ]
    > &
      Attribute.DefaultTo<'queued'>;
    pagesScanned: Attribute.Integer & Attribute.DefaultTo<0>;
    listingsCreated: Attribute.Integer & Attribute.DefaultTo<0>;
    listingsUpdated: Attribute.Integer & Attribute.DefaultTo<0>;
    listingsArchived: Attribute.Integer & Attribute.DefaultTo<0>;
    shortTermCandidatesDetected: Attribute.Integer & Attribute.DefaultTo<0>;
    shortTermCandidatesBlocked: Attribute.Integer & Attribute.DefaultTo<0>;
    policyBlockCount: Attribute.Integer & Attribute.DefaultTo<0>;
    warningsJson: Attribute.JSON;
    errorsJson: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::sync-run.sync-run',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::sync-run.sync-run',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSyncRunItemSyncRunItem extends Schema.CollectionType {
  collectionName: 'sync_run_items';
  info: {
    singularName: 'sync-run-item';
    pluralName: 'sync-run-items';
    displayName: 'SyncRunItem';
    description: 'Per-listing outcome record for a sync run.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    syncRun: Attribute.Relation<
      'api::sync-run-item.sync-run-item',
      'manyToOne',
      'api::sync-run.sync-run'
    >;
    sourceListing: Attribute.Relation<
      'api::sync-run-item.sync-run-item',
      'manyToOne',
      'api::source-listing.source-listing'
    >;
    action: Attribute.Enumeration<
      ['created', 'updated', 'unchanged', 'blocked', 'failed']
    >;
    status: Attribute.Enumeration<
      [
        'created',
        'updated',
        'unchanged',
        'suppressed',
        'archived',
        'low_confidence_review',
        'conflict_detected',
        'failed',
        'blocked_by_policy'
      ]
    >;
    notes: Attribute.Text;
    confidenceScore: Attribute.Decimal;
    policyReasonCode: Attribute.String;
    classifierOutputJson: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::sync-run-item.sync-run-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::sync-run-item.sync-run-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiVerificationRequestVerificationRequest
  extends Schema.CollectionType {
  collectionName: 'verification_requests';
  info: {
    singularName: 'verification-request';
    pluralName: 'verification-requests';
    displayName: 'VerificationRequest';
    description: 'Tracks identity, domain, and business verification submissions and outcomes.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    ownerType: Attribute.Enumeration<['agency', 'user']> & Attribute.Required;
    ownerId: Attribute.String & Attribute.Required;
    verificationType: Attribute.Enumeration<
      ['identity', 'domain', 'business']
    > &
      Attribute.Required;
    status: Attribute.Enumeration<
      [
        'unstarted',
        'pending',
        'verified',
        'rejected',
        'manual_review_required',
        'expired'
      ]
    > &
      Attribute.Required &
      Attribute.DefaultTo<'unstarted'>;
    method: Attribute.Enumeration<
      ['dns_txt', 'meta_tag', 'email_domain', 'business_doc', 'admin_manual']
    >;
    evidenceAsset: Attribute.Media;
    reviewer: Attribute.Relation<
      'api::verification-request.verification-request',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    submittedAt: Attribute.DateTime;
    decidedAt: Attribute.DateTime;
    notes: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::verification-request.verification-request',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::verification-request.verification-request',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface ContentTypes {
      'admin::permission': AdminPermission;
      'admin::user': AdminUser;
      'admin::role': AdminRole;
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
      'api::agency.agency': ApiAgencyAgency;
      'api::agency-membership.agency-membership': ApiAgencyMembershipAgencyMembership;
      'api::agent-testimonial.agent-testimonial': ApiAgentTestimonialAgentTestimonial;
      'api::article.article': ApiArticleArticle;
      'api::blocked-domain.blocked-domain': ApiBlockedDomainBlockedDomain;
      'api::brand-profile.brand-profile': ApiBrandProfileBrandProfile;
      'api::canonical-listing.canonical-listing': ApiCanonicalListingCanonicalListing;
      'api::contact-form.contact-form': ApiContactFormContactForm;
      'api::favorite.favorite': ApiFavoriteFavorite;
      'api::filter-option.filter-option': ApiFilterOptionFilterOption;
      'api::guide-article.guide-article': ApiGuideArticleGuideArticle;
      'api::home-page.home-page': ApiHomePageHomePage;
      'api::lead.lead': ApiLeadLead;
      'api::listing.listing': ApiListingListing;
      'api::listing-availability.listing-availability': ApiListingAvailabilityListingAvailability;
      'api::listing-feature.listing-feature': ApiListingFeatureListingFeature;
      'api::listing-form.listing-form': ApiListingFormListingForm;
      'api::listing-history.listing-history': ApiListingHistoryListingHistory;
      'api::listing-media.listing-media': ApiListingMediaListingMedia;
      'api::listing-space.listing-space': ApiListingSpaceListingSpace;
      'api::nav-link.nav-link': ApiNavLinkNavLink;
      'api::page-content.page-content': ApiPageContentPageContent;
      'api::plan.plan': ApiPlanPlan;
      'api::policy-block-event.policy-block-event': ApiPolicyBlockEventPolicyBlockEvent;
      'api::property-submission.property-submission': ApiPropertySubmissionPropertySubmission;
      'api::reservation.reservation': ApiReservationReservation;
      'api::saved-search.saved-search': ApiSavedSearchSavedSearch;
      'api::sort-option.sort-option': ApiSortOptionSortOption;
      'api::source-connection.source-connection': ApiSourceConnectionSourceConnection;
      'api::source-listing.source-listing': ApiSourceListingSourceListing;
      'api::subscription.subscription': ApiSubscriptionSubscription;
      'api::sync-run.sync-run': ApiSyncRunSyncRun;
      'api::sync-run-item.sync-run-item': ApiSyncRunItemSyncRunItem;
      'api::verification-request.verification-request': ApiVerificationRequestVerificationRequest;
    }
  }
}
